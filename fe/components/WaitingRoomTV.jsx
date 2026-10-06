'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Volume2, VolumeX, Maximize2, Minimize2, Clock, Activity,
  Users, AlertCircle, ArrowLeft, RefreshCw, Bell
} from 'lucide-react';
import ApiService from '../services/api';

export default function WaitingRoomTV() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [flowBoard, setFlowBoard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [lastCalledId, setLastCalledId] = useState(null);
  const [flashCall, setFlashCall] = useState(false);

  // Play audio chime using Web Audio API
  const playChime = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.3); // A5

      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.8);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.8);
    } catch (e) {
      console.warn('Audio not allowed yet:', e);
    }
  };

  // Clock interval
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Poll flow board every 4 seconds
  useEffect(() => {
    fetchQueueData();
    const pollTimer = setInterval(fetchQueueData, 4000);
    return () => clearInterval(pollTimer);
  }, [soundEnabled]);

  const fetchQueueData = async () => {
    try {
      const data = await ApiService.getPatientFlowBoard();
      setFlowBoard(data);

      // Check if current examining patient changed
      const examining = data?.danh_sach?.find(i => i.trang_thai === 'dang_kham');
      if (examining && examining.ticket_id !== lastCalledId) {
        setLastCalledId(examining.ticket_id);
        setFlashCall(true);
        playChime();
        setTimeout(() => setFlashCall(false), 3000);
      }
    } catch (e) {
      // Fallback demo queue
      if (!flowBoard) {
        setFlowBoard({
          danh_sach: [
            { ticket_id: 1, so_thu_tu_kham: 101, ten_benh_nhan: 'NGUYỄN VĂN A***', ten_bac_si: 'BS. CKII Lê Minh Tuấn', phong_kham: 'Phòng khám 101 - Nội tim mạch', trang_thai: 'dang_kham' },
            { ticket_id: 2, so_thu_tu_kham: 102, ten_benh_nhan: 'TRẦN THỊ M***', ten_bac_si: 'BS. CKII Lê Minh Tuấn', phong_kham: 'Phòng khám 101 - Nội tim mạch', trang_thai: 'cho_kham', thoi_gian_cho_phut: 5 },
            { ticket_id: 3, so_thu_tu_kham: 103, ten_benh_nhan: 'LÊ HOÀNG L***', ten_bac_si: 'BS. CKI Phạm Thu Hà', phong_kham: 'Phòng khám 102 - Nhi khoa', trang_thai: 'cho_kham', thoi_gian_cho_phut: 12 },
            { ticket_id: 4, so_thu_tu_kham: 104, ten_benh_nhan: 'HOÀNG VĂN K***', ten_bac_si: 'BS. CKII Lê Minh Tuấn', phong_kham: 'Phòng khám 101 - Nội tim mạch', trang_thai: 'tam_hoan', so_lan_goi: 3 },
            { ticket_id: 5, so_thu_tu_kham: 100, ten_benh_nhan: 'VŨ ĐÌNH T***', ten_bac_si: 'BS. CKII Lê Minh Tuấn', phong_kham: 'Phòng khám 101 - Nội tim mạch', trang_thai: 'da_kham' }
          ]
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const examiningList = flowBoard?.danh_sach?.filter(i => i.trang_thai === 'dang_kham') || [];
  const waitingList = flowBoard?.danh_sach?.filter(i => i.trang_thai === 'cho_kham') || [];
  const postponedList = flowBoard?.danh_sach?.filter(i => i.trang_thai === 'tam_hoan') || [];

  // Obfuscate patient name for privacy on public TV
  const maskName = (name) => {
    if (!name) return 'BỆNH NHÂN';
    const parts = name.trim().split(' ');
    if (parts.length <= 1) return name;
    return parts.map((p, idx) => (idx === parts.length - 1 ? p[0] + '***' : p)).join(' ').toUpperCase();
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-white flex flex-col justify-between font-sans selection:bg-emerald-500 selection:text-white">
      {/* Top TV Bar: Clinic Branding + Live Digital Clock + Controls */}
      <header className="bg-[#1E293B]/90 border-b border-slate-700/60 px-6 py-4 flex items-center justify-between shadow-xl backdrop-blur">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition"
            title="Về trang chủ"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <Activity className="w-6 h-6 animate-pulse" />
            </span>
            <div>
              <h1 className="text-xl md:text-2xl font-black tracking-wide text-white flex items-center gap-2">
                <span>HỆ THỐNG GỌI SỐ PHÒNG KHÁM THỜI GIAN THỰC</span>
              </h1>
              <p className="text-xs text-slate-400 font-medium">
                Màn hình hiển thị hàng đợi sảnh chờ • Tự động cập nhật mỗi 4 giây
              </p>
            </div>
          </div>
        </div>

        {/* Right: Live Digital Clock & Fullscreen / Sound buttons */}
        <div className="flex items-center gap-5">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition ${
              soundEnabled
                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
            }`}
            title={soundEnabled ? 'Tắt âm báo' : 'Bật chuông thông báo khi gọi số mới'}
          >
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            <span className="hidden sm:inline">{soundEnabled ? 'Chuông: BẬT' : 'Chuông: TẮT'}</span>
          </button>

          <button
            onClick={toggleFullScreen}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 hover:text-white transition"
            title="Toàn màn hình (F11)"
          >
            <Maximize2 className="w-5 h-5" />
          </button>

          <div className="bg-slate-900/80 border border-slate-700/80 px-4 py-2 rounded-xl text-right">
            <div className="text-2xl md:text-3xl font-mono font-bold text-emerald-400 tracking-wider">
              {currentTime.toLocaleTimeString('vi-VN')}
            </div>
            <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
              {currentTime.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
            </div>
          </div>
        </div>
      </header>

      {/* Main Grid: 2 Large Columns */}
      <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* COLUMN 1: NOW CALLING / EXAMINING (7 COLS) */}
        <section className="lg:col-span-7 flex flex-col space-y-4">
          <div className="flex items-center justify-between border-b border-emerald-500/40 pb-2">
            <h2 className="text-lg md:text-xl font-black uppercase text-emerald-400 tracking-wider flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 animate-ping"></span>
              <span>ĐANG MỜI VÀO PHÒNG KHÁM (NOW SERVING)</span>
            </h2>
            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full text-xs font-bold">
              {examiningList.length} PHÒNG ĐANG KHÁM
            </span>
          </div>

          <div className="flex-1 flex flex-col gap-4">
            {examiningList.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 bg-slate-800/40 border border-slate-700/60 rounded-2xl text-center space-y-3">
                <Users className="w-16 h-16 text-slate-600" />
                <h3 className="text-xl font-bold text-slate-400">Các phòng khám đang chuẩn bị</h3>
                <p className="text-sm text-slate-500">
                  Bác sĩ sẽ gọi bệnh nhân tiếp theo ngay khi sẵn sàng. Quý khách vui lòng ngồi chờ tại sảnh.
                </p>
              </div>
            ) : (
              examiningList.map((item, idx) => (
                <div
                  key={idx}
                  className={`p-6 bg-gradient-to-br from-emerald-950/60 via-slate-800/80 to-slate-900 border-2 rounded-2xl shadow-2xl flex flex-col justify-between transition-all duration-500 ${
                    flashCall
                      ? 'border-yellow-400 ring-4 ring-yellow-400/50 scale-[1.01]'
                      : 'border-emerald-500/60 hover:border-emerald-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-bold uppercase tracking-wider">
                      MỜI VÀO PHÒNG
                    </span>
                    <span className="text-sm text-slate-400 font-semibold">
                      {item.phong_kham || 'Phòng khám 101'}
                    </span>
                  </div>

                  <div className="my-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-slate-400 font-bold">SỐ THỨ TỰ (STT)</p>
                      <div className="text-6xl md:text-8xl font-black font-mono text-emerald-400 tracking-tight drop-shadow-[0_0_20px_rgba(52,211,153,0.4)]">
                        #{item.so_thu_tu_kham}
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-xs uppercase tracking-widest text-slate-400 font-bold">BỆNH NHÂN</p>
                      <div className="text-2xl md:text-4xl font-extrabold text-white tracking-wide">
                        {maskName(item.ten_benh_nhan)}
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-700/80 flex items-center justify-between text-sm text-slate-300">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                      <span>Bác sĩ phụ trách: <strong className="text-white">{item.ten_bac_si}</strong></span>
                    </div>
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <Bell className="w-4 h-4 animate-bounce" /> Vui lòng bước vào
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* COLUMN 2: NEXT IN LINE & POSTPONED (5 COLS) */}
        <section className="lg:col-span-5 flex flex-col space-y-5">
          {/* Section: Next in line */}
          <div className="flex-1 flex flex-col space-y-3">
            <div className="flex items-center justify-between border-b border-amber-500/40 pb-2">
              <h2 className="text-base md:text-lg font-black uppercase text-amber-400 tracking-wider flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-400" />
                <span>CHUẨN BỊ VÀO PHÒNG (NEXT IN LINE)</span>
              </h2>
              <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full text-xs font-bold">
                {waitingList.length} ĐANG CHỜ
              </span>
            </div>

            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {waitingList.length === 0 ? (
                <div className="p-6 bg-slate-800/40 border border-slate-700/60 rounded-xl text-center text-slate-500 text-xs italic">
                  Không còn bệnh nhân nào đang chờ tiếp theo.
                </div>
              ) : (
                waitingList.slice(0, 5).map((w, idx) => (
                  <div
                    key={w.ticket_id}
                    className="p-3.5 bg-slate-800/70 border border-slate-700 hover:border-amber-500/50 rounded-xl flex items-center justify-between transition"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold font-mono text-sm">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="text-sm font-bold text-white flex items-center gap-2">
                          <span className="font-mono text-emerald-400">#{w.so_thu_tu_kham}</span>
                          <span>{maskName(w.ten_benh_nhan)}</span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {w.ten_bac_si} • {w.phong_kham || 'P.Khám'}
                        </div>
                      </div>
                    </div>

                    <div className="text-right text-xs">
                      <span className="px-2 py-0.5 rounded bg-slate-700/80 text-amber-300 text-[11px] font-medium">
                        Chuẩn bị
                      </span>
                      <p className="text-[10px] text-slate-400 mt-1">Chờ ~{w.thoi_gian_cho_phut || 5}p</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Section: Postponed / Needs Reception Check */}
          <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between border-b border-rose-500/30 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-rose-400" />
                <span>TẠM HOÃN / VẮNG KHI GỌI TÊN</span>
              </h3>
              <span className="text-[11px] text-rose-300 bg-rose-500/20 px-2 py-0.5 rounded-full font-bold">
                {postponedList.length}
              </span>
            </div>

            <p className="text-[11px] text-slate-400">
              Quý bệnh nhân có số thứ tự dưới đây vui lòng liên hệ <strong>Bàn Tiếp Đón</strong> để được phục hồi vé khám:
            </p>

            <div className="flex flex-wrap gap-2 pt-1">
              {postponedList.length === 0 ? (
                <span className="text-xs text-slate-500 italic">Không có vé nào bị tạm hoãn.</span>
              ) : (
                postponedList.map(p => (
                  <span
                    key={p.ticket_id}
                    className="px-2.5 py-1 bg-rose-500/20 border border-rose-500/40 text-rose-300 rounded-lg text-xs font-mono font-bold"
                  >
                    #{p.so_thu_tu_kham} - {maskName(p.ten_benh_nhan)}
                  </span>
                ))
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Bottom Marquee Running Ticker */}
      <footer className="bg-emerald-950/80 border-t border-emerald-500/30 px-6 py-3 flex items-center gap-4 text-xs font-medium text-emerald-200">
        <span className="px-2.5 py-1 bg-emerald-600 text-white rounded font-bold uppercase text-[10px] tracking-wider whitespace-nowrap">
          THÔNG BÁO QUAN TRỌNG
        </span>
        <div className="overflow-hidden whitespace-nowrap w-full">
          <p className="animate-marquee inline-block font-medium">
            📢 Quý người bệnh vui lòng chuẩn bị sẵn Căn cước công dân gắn chip hoặc Thẻ BHYT trước khi bước vào phòng khám • Vui lòng giữ trật tự và chú ý theo dõi loa gọi số thứ tự của phòng khám • Mọi thắc mắc xin liên hệ quầy tiếp đón tại cửa sảnh A.
          </p>
        </div>
      </footer>
    </div>
  );
}
