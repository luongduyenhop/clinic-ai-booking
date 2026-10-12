import { useState } from 'react'
import { AppToast } from '../../components/common/AppNotification'
import {
    DownloadSimple,
    QrCode,
    CheckCircle,
    Stethoscope,
    Users,
    ShieldCheck,
    Globe,
    Lightning,
} from '../../components/common/ClinicIcon'

export default function DownloadAppPage() {
    return (
        <div className="space-y-4">
            {/* Top Navigation & Operational Summary */}
            <div className="bg-white rounded-2xl shadow-xs border border-[#E5EEF5] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <span className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#00B5F1] to-[#0088BA] text-white flex items-center justify-center shadow-md">
                        <DownloadSimple size={24} weight="fill" />
                    </span>
                    <div>
                        <h1 className="text-lg font-black text-[#003553] tracking-wide flex items-center gap-2">
                            TẢI ỨNG DỤNG DI ĐỘNG CLINIC-AI (/tai-ung-dung)
                            <span className="px-2 py-0.5 rounded-full bg-sky-100 text-[#00B5F1] text-[11px] font-bold">
                                Mobile App Ecosystem
                            </span>
                        </h1>
                        <p className="text-xs text-slate-500">
                            Hệ sinh thái di động hoàn chỉnh: Ứng dụng đặt khám cho người bệnh & Ứng dụng ký số bệnh án cho Bác sĩ
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        iOS & Android v2.6 Ready
                    </span>
                </div>
            </div>

            {/* 2 Main App Download Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* CARD 1: APP BỆNH NHÂN */}
                <div className="bg-white rounded-2xl border border-[#E5EEF5] p-6 shadow-2xs hover:shadow-md transition flex flex-col justify-between space-y-5">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="px-2.5 py-1 rounded-full bg-sky-100 text-[#00B5F1] text-xs font-bold flex items-center gap-1">
                                <Users size={14} weight="bold" />
                                DÀNH CHO BỆNH NHÂN
                            </span>
                            <span className="text-xs text-slate-400 font-medium">Miễn phí 100%</span>
                        </div>

                        <div>
                            <h2 className="text-xl font-black text-[#003553]">Clinic-AI Booking</h2>
                            <p className="text-xs text-slate-500 mt-1">
                                Ứng dụng đặt lịch khám bệnh 1-chạm, tra cứu hồ sơ sức khỏe và nhận kết quả cận lâm sàng trực tuyến
                            </p>
                        </div>

                        {/* QR Code and Badges */}
                        <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-xl bg-[#F8FCFF] border border-sky-100">
                            <div className="w-36 h-36 bg-white p-2.5 rounded-xl shadow-xs border border-slate-200 flex items-center justify-center shrink-0">
                                <QrCode size={115} className="text-[#003553]" />
                            </div>
                            <div className="space-y-2 text-xs">
                                <div className="font-bold text-[#003553]">Quét mã QR để tải ứng dụng ngay:</div>
                                <div className="text-slate-500 text-[11px]">
                                    Hỗ trợ điện thoại iPhone (iOS 14.0+) và các dòng máy Android (Samsung, Xiaomi, Oppo...).
                                </div>
                                <div className="pt-2 flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={() => AppToast.info('Đang mở liên kết Apple App Store...')}
                                        className="px-3 py-1.5 rounded-lg bg-black text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                                    >
                                        <span>App Store</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => AppToast.info('Đang mở liên kết Google Play Store...')}
                                        className="px-3 py-1.5 rounded-lg bg-[#0088BA] text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                                    >
                                        <span>Google Play</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Feature highlights */}
                        <div className="space-y-2 text-xs">
                            <div className="font-bold text-[#003553] uppercase text-[11px]">TÍNH NĂNG NỔI BẬT DÀNH CHO NGƯỜI BỆNH:</div>
                            <ul className="space-y-1.5 text-slate-600">
                                <li className="flex items-center gap-2">
                                    <CheckCircle size={14} weight="fill" className="text-emerald-500 shrink-0" />
                                    <span>Đặt lịch hẹn khám theo giờ chính xác, giảm 70% thời gian chờ đợi</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <CheckCircle size={14} weight="fill" className="text-emerald-500 shrink-0" />
                                    <span>Xem kết quả xét nghiệm máu, siêu âm và hình ảnh X-Quang độ phân giải cao</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <CheckCircle size={14} weight="fill" className="text-emerald-500 shrink-0" />
                                    <span>Nhận đơn thuốc điện tử đồng bộ trực tiếp từ Cổng Đơn thuốc Quốc gia BYT</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <CheckCircle size={14} weight="fill" className="text-emerald-500 shrink-0" />
                                    <span>Thanh toán viện phí không tiền mặt tiện lợi qua chuẩn VietQR</span>
                                </li>
                            </ul>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                        <span>Đánh giá 4.9 ★ (12,500+ lượt tải)</span>
                        <span className="font-mono">Phiên bản: 2.6.4</span>
                    </div>
                </div>

                {/* CARD 2: APP BÁC SĨ */}
                <div className="bg-white rounded-2xl border border-[#E5EEF5] p-6 shadow-2xs hover:shadow-md transition flex flex-col justify-between space-y-5">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-1">
                                <Stethoscope size={14} weight="bold" />
                                DÀNH CHO BÁC SĨ & KTV
                            </span>
                            <span className="text-xs text-purple-600 font-bold bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                                Ký số HSM SmartCA
                            </span>
                        </div>

                        <div>
                            <h2 className="text-xl font-black text-[#003553]">Clinic-AI Doctor</h2>
                            <p className="text-xs text-slate-500 mt-1">
                                Ứng dụng nghiệp vụ di động cho phép Bác sĩ xem bệnh án, ký số đơn thuốc từ xa và quản lý ca trực
                            </p>
                        </div>

                        {/* QR Code and Badges */}
                        <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-xl bg-[#F6FDF9] border border-emerald-100">
                            <div className="w-36 h-36 bg-white p-2.5 rounded-xl shadow-xs border border-slate-200 flex items-center justify-center shrink-0">
                                <QrCode size={115} className="text-emerald-800" />
                            </div>
                            <div className="space-y-2 text-xs">
                                <div className="font-bold text-[#003553]">Quét mã tải ứng dụng Bác sĩ:</div>
                                <div className="text-slate-500 text-[11px]">
                                    Cài đặt nội bộ bảo mật cho nhân sự y tế có Chứng chỉ Hành nghề (CCHN) được cấp quyền.
                                </div>
                                <div className="pt-2 flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={() => AppToast.success('Đang tạo liên kết tải file APK bảo mật nội bộ...')}
                                        className="px-3 py-1.5 rounded-lg bg-[#003553] text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                                    >
                                        <DownloadSimple size={13} weight="bold" />
                                        <span>Tải file APK nội bộ</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => AppToast.info('Đang mở cổng chứng thực Mobile MDM...')}
                                        className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-[11px] font-bold hover:bg-slate-50 cursor-pointer"
                                    >
                                        <span>TestFlight iOS</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Feature highlights */}
                        <div className="space-y-2 text-xs">
                            <div className="font-bold text-[#003553] uppercase text-[11px]">TÍNH NĂNG CHUYÊN MÔN DÀNH CHO BÁC SĨ:</div>
                            <ul className="space-y-1.5 text-slate-600">
                                <li className="flex items-center gap-2">
                                    <CheckCircle size={14} weight="fill" className="text-emerald-500 shrink-0" />
                                    <span>Ký số từ xa hồ sơ bệnh án & đơn thuốc qua VNPT SmartCA HSM (Nghị định 130)</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <CheckCircle size={14} weight="fill" className="text-emerald-500 shrink-0" />
                                    <span>Tra cứu tiền sử bệnh án, dị ứng thuốc và tương tác thuốc thời gian thực</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <CheckCircle size={14} weight="fill" className="text-emerald-500 shrink-0" />
                                    <span>Xem danh sách bệnh nhân chờ khám theo từng phòng chức năng và số thứ tự</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <CheckCircle size={14} weight="fill" className="text-emerald-500 shrink-0" />
                                    <span>Nhận cảnh báo kết quả Cận lâm sàng khẩn (Panic Alert) tức thì qua Push Notification</span>
                                </li>
                            </ul>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                        <span>Bảo mật cấp độ 3 y tế</span>
                        <span className="font-mono">Phiên bản: 1.8.2</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
