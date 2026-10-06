'use client';

import React from 'react';
import { X, Lock, Clock, Calendar, User, FileText, Pill, Activity, ShieldCheck, AlertCircle } from 'lucide-react';

export default function PatientHistoryDrawer({
  isOpen,
  onClose,
  patient,
  historyList = [],
  isLoading = false
}) {
  if (!isOpen) {
    return null;
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const renderEncounter = (encounter, index) => {
    const isLocked = encounter.is_locked === true;
    
    // Normalize don_thuoc: might be { chi_tiet: [...] } or direct array
    const donThuocItems = Array.isArray(encounter.don_thuoc)
      ? encounter.don_thuoc
      : Array.isArray(encounter.don_thuoc?.chi_tiet)
      ? encounter.don_thuoc.chi_tiet
      : [];

    const chanDoanList = Array.isArray(encounter.chan_doan) ? encounter.chan_doan : [];
    const chiDinhList = Array.isArray(encounter.chi_dinh) ? encounter.chi_dinh : [];

    return (
      <div
        key={encounter.id || index}
        className={`rounded-xl border transition shadow-sm ${
          index === 0
            ? 'border-[#1F6F5C]/40 bg-white ring-1 ring-[#1F6F5C]/20'
            : 'border-[#E4E1D8] bg-white'
        } p-4 space-y-3.5`}
      >
        {/* Header lượt khám */}
        <div className="flex items-start justify-between border-b pb-3 border-gray-100">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-[#1F6F5C]" />
                <span>Lần khám #{historyList.length - index}</span>
              </h4>
              {isLocked ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 border border-gray-300 px-2 py-0.5 text-[10px] font-bold text-gray-700">
                  <Lock className="w-3 h-3 text-gray-600" />
                  <span>ĐÃ KHÓA (TT 32/2023)</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                  <span>ĐANG MỞ</span>
                </span>
              )}
            </div>
            <div className="mt-1 text-xs text-gray-500 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>{formatDate(encounter.thoi_gian_kham || encounter.created_at)}</span>
            </div>
          </div>
          <div className="text-right text-xs text-gray-600">
            <div className="font-bold text-gray-900">
              BS. {encounter.bac_si?.ho_ten || encounter.bac_si_ten || 'Phụ trách'}
            </div>
            <div className="text-[11px] text-gray-500">
              {encounter.chuyen_khoa?.ten_chuyen_khoa || encounter.ten_chuyen_khoa || 'Nội tổng quát'}
            </div>
          </div>
        </div>

        {/* Chẩn đoán */}
        {chanDoanList.length > 0 ? (
          <div>
            <div className="mb-1 text-xs font-bold text-gray-700 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-[#1F6F5C]" />
              <span>Chẩn đoán xác định (ICD-10):</span>
            </div>
            <ul className="space-y-1 pl-1">
              {chanDoanList.map((cd, idx) => {
                const isPrimary = cd.is_primary || cd.is_chinh || cd.loai_chan_doan === 'CHINH';
                const icdCode = cd.icd10_code || cd.ma_benh;
                return (
                  <li key={idx} className="text-xs text-gray-800 flex items-start gap-1.5">
                    {isPrimary && (
                      <span className="rounded bg-rose-50 border border-rose-200 px-1.5 py-0.2 text-[10px] font-bold text-rose-700">
                        Chính
                      </span>
                    )}
                    <span className="font-semibold text-gray-900">{cd.ten_benh}</span>
                    {icdCode && (
                      <span className="font-mono text-[#1F6F5C] font-bold">[{icdCode}]</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : encounter.diagnosis_primary ? (
          <div>
            <div className="mb-1 text-xs font-bold text-gray-700 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-[#1F6F5C]" />
              <span>Chẩn đoán:</span>
            </div>
            <p className="text-xs text-gray-800 pl-1 font-medium">
              {encounter.diagnosis_primary} {encounter.icd10_code && `[${encounter.icd10_code}]`}
            </p>
          </div>
        ) : null}

        {/* Đơn thuốc ngoại trú */}
        {donThuocItems.length > 0 && (
          <div>
            <div className="mb-1 text-xs font-bold text-gray-700 flex items-center gap-1">
              <Pill className="w-3.5 h-3.5 text-[#1F6F5C]" />
              <span>Đơn thuốc đã kê ({donThuocItems.length} loại):</span>
            </div>
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-2 text-xs space-y-1">
              {donThuocItems.slice(0, 4).map((thuoc, idx) => (
                <div key={idx} className="text-gray-800 flex items-center justify-between">
                  <div>
                    <span className="font-semibold">{idx + 1}. {thuoc.ten_thuoc || thuoc.medicine_name}</span>
                    <span className="text-gray-500 text-[11px] ml-1">
                      ({thuoc.cach_dung || thuoc.usage || thuoc.lieu_dung})
                    </span>
                  </div>
                  <span className="font-mono text-gray-700 text-[11px]">
                    {thuoc.so_luong || thuoc.quantity} {thuoc.don_vi || thuoc.unit || 'viên'}
                  </span>
                </div>
              ))}
              {donThuocItems.length > 4 && (
                <div className="text-[11px] text-[#1F6F5C] font-medium pt-1 italic">
                  + {donThuocItems.length - 4} loại thuốc khác...
                </div>
              )}
            </div>
          </div>
        )}

        {/* Chỉ định Cận lâm sàng */}
        {chiDinhList.length > 0 && (
          <div>
            <div className="mb-1 text-xs font-bold text-gray-700 flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-[#1F6F5C]" />
              <span>Cận lâm sàng & Kết quả:</span>
            </div>
            <div className="space-y-1 pl-1">
              {chiDinhList.map((cd, idx) => {
                const hasResult = cd.trang_thai === 'da_co_ket_qua' || Boolean(cd.ket_qua_chi_tiet);
                return (
                  <div key={idx} className="text-xs text-gray-800 rounded bg-[#F7F5F0] border border-[#E4E1D8] p-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-900">
                        {cd.dich_vu?.ten_dich_vu || cd.ten_dich_vu || cd.ten_chi_dinh || cd.noi_dung_chi_dinh}
                      </span>
                      {hasResult ? (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          ✓ Đã có KQ
                        </span>
                      ) : (
                        <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                          Chờ KQ
                        </span>
                      )}
                    </div>
                    {cd.ket_qua_chi_tiet && (
                      <p className="mt-1 font-mono text-[11px] text-gray-600 line-clamp-2">
                        KQ: {cd.ket_qua_chi_tiet}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Kết luận & Lời dặn */}
        {(encounter.ket_luan_dieu_tri || encounter.loi_dan_bac_si) && (
          <div className="rounded-lg bg-emerald-50/50 border border-emerald-200/60 p-2.5 text-xs text-gray-800 space-y-1">
            {encounter.ket_luan_dieu_tri && (
              <div>
                <strong className="text-[#1F6F5C]">Kết luận: </strong>
                <span>{encounter.ket_luan_dieu_tri}</span>
              </div>
            )}
            {encounter.loi_dan_bac_si && (
              <div>
                <strong className="text-[#1F6F5C]">Lời dặn: </strong>
                <span>{encounter.loi_dan_bac_si}</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/50 transition-opacity animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col bg-[#FAF9F5] shadow-2xl border-l border-[#E4E1D8] animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E4E1D8] bg-white px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#1F6F5C]" />
              <h3 className="text-base font-bold text-[#1C1B19]">
                Hồ Sơ Bệnh Án Dài Hạn (Longitudinal EMR)
              </h3>
            </div>
            {patient && (
              <div className="mt-1 text-xs text-gray-600 flex items-center gap-2">
                <span className="font-bold text-gray-900">{patient.ho_ten || patient.patient_name}</span>
                <span>• {patient.gioi_tinh || patient.patient_gender || 'Nam'}</span>
                <span>• {patient.nam_sinh || patient.patient_birth_year || '1985'}</span>
                <span>• SĐT: {patient.sdt || patient.patient_phone || 'Chưa có'}</span>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isLoading ? (
            <div className="flex h-full flex-col items-center justify-center text-gray-500 text-xs space-y-2">
              <div className="w-6 h-6 border-2 border-[#1F6F5C] border-t-transparent rounded-full animate-spin"></div>
              <span>Đang truy xuất hồ sơ các lần khám cũ từ CSDL...</span>
            </div>
          ) : historyList.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-gray-500 py-12 space-y-2">
              <div className="text-4xl">📭</div>
              <h4 className="font-bold text-sm text-gray-800">Chưa có lịch sử các lần khám trước</h4>
              <p className="text-xs text-gray-500 max-w-xs">
                Bệnh nhân lần đầu khám tại phòng khám hoặc chưa có hồ sơ bệnh án nào đã được khóa trong hệ thống.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-gray-500 px-1">
                <span>Tìm thấy <strong>{historyList.length}</strong> lần khám trong lịch sử:</span>
                <span className="text-[11px] italic">Xếp theo thứ tự mới nhất</span>
              </div>
              {historyList.map((encounter, index) =>
                renderEncounter(encounter, index)
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[#E4E1D8] bg-white px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg border border-gray-300 bg-white py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50 shadow-sm"
          >
            Đóng ngăn kéo EMR
          </button>
        </div>
      </div>
    </>
  );
}
