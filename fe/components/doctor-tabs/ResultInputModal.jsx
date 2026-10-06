'use client';

import React, { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Link as LinkIcon, FileText } from 'lucide-react';

export default function ResultInputModal({
  isOpen,
  order,
  onClose,
  onSave,
  isSaving = false
}) {
  const [ketQuaChiTiet, setKetQuaChiTiet] = useState('');
  const [tepDinhKemUrl, setTepDinhKemUrl] = useState('');
  const [mucDoCanhBao, setMucDoCanhBao] = useState('BINH_THUONG');
  const [error, setError] = useState('');

  // Reset form mỗi khi mở modal với order mới
  useEffect(() => {
    if (isOpen && order) {
      setKetQuaChiTiet(order.ket_qua_chi_tiet || '');
      setTepDinhKemUrl(order.tep_dinh_kem_url || '');
      setMucDoCanhBao(order.ket_qua_phan_loai || order.muc_do_canh_bao || 'BINH_THUONG');
      setError('');
    }
  }, [isOpen, order]);

  const isValidUrl = (str) => {
    if (!str) return true; // optional field
    try {
      const parsed = new URL(str);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const handleSave = () => {
    setError('');

    const trimmedKetQua = ketQuaChiTiet.trim();
    const trimmedUrl = tepDinhKemUrl.trim();

    // Validate
    if (!trimmedKetQua) {
      setError('Kết quả cận lâm sàng không được để trống.');
      return;
    }

    if (trimmedUrl && !isValidUrl(trimmedUrl)) {
      setError('URL file đính kèm không hợp lệ (phải bắt đầu bằng http:// hoặc https://).');
      return;
    }

    onSave(order.id, {
      ket_qua_chi_tiet: trimmedKetQua,
      tep_dinh_kem_url: trimmedUrl || null,
      ket_qua_phan_loai: mucDoCanhBao,
      muc_do_canh_bao: mucDoCanhBao
    });
  };

  if (!isOpen || !order) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl border border-[#E4E1D8] space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between border-b pb-3">
          <div>
            <h3 className="text-base font-bold text-[#1C1B19] flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#1F6F5C]" />
              <span>Nhập / Trả Kết Quả Cận Lâm Sàng</span>
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Cập nhật trị số xét nghiệm và kết luận chẩn đoán hình ảnh
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info chỉ định */}
        <div className="rounded-lg bg-[#F7F5F0] border border-[#E4E1D8] p-3 text-xs space-y-1">
          <div className="font-bold text-gray-900 text-sm">
            {order.name || order.ten_dich_vu || order.ten_chi_dinh}
          </div>
          <div className="text-gray-600 flex items-center gap-3">
            <span>Mã: <strong className="font-mono text-[#1F6F5C]">{order.code || order.ma_dich_vu || `#${order.id}`}</strong></span>
            {order.price && <span>Đơn giá: <strong>{Number(order.price).toLocaleString('vi-VN')} đ</strong></span>}
          </div>
          {order.note && (
            <div className="text-gray-500 italic">
              Ghi chú chỉ định: {order.note}
            </div>
          )}
        </div>

        {/* Form */}
        <div className="space-y-3 text-xs">
          {/* Mức độ cảnh báo lâm sàng (OpenMRS / Bahmni Critical Value Flagging) */}
          <div>
            <label className="block font-semibold text-gray-700 mb-1.5">
              Phân loại trị số / Mức độ cảnh báo lâm sàng <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setMucDoCanhBao('BINH_THUONG')}
                className={`p-2.5 rounded-lg border text-left transition ${
                  mucDoCanhBao === 'BINH_THUONG'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold ring-1 ring-emerald-600'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
                  <span className="text-xs">Bình thường</span>
                </div>
                <p className="text-[10px] text-gray-500 mt-0.5">Trong giới hạn tham chiếu</p>
              </button>

              <button
                type="button"
                onClick={() => setMucDoCanhBao('BAT_THUONG')}
                className={`p-2.5 rounded-lg border text-left transition ${
                  mucDoCanhBao === 'BAT_THUONG'
                    ? 'border-amber-600 bg-amber-50 text-amber-900 font-bold ring-1 ring-amber-600'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0"></span>
                  <span className="text-xs">Bất thường</span>
                </div>
                <p className="text-[10px] text-gray-500 mt-0.5">Ngoài khoảng tham chiếu</p>
              </button>

              <button
                type="button"
                onClick={() => setMucDoCanhBao('NGUY_KICH')}
                className={`p-2.5 rounded-lg border text-left transition ${
                  mucDoCanhBao === 'NGUY_KICH'
                    ? 'border-rose-600 bg-rose-50 text-rose-900 font-bold ring-1 ring-rose-600 animate-pulse'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-rose-300'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-600 shrink-0"></span>
                  <span className="text-xs">⚠️ Nguy kịch</span>
                </div>
              </button>
            </div>
            <div className="mt-1.5 p-2 bg-blue-50/70 border border-blue-200/60 rounded-md text-[11px] text-blue-800 leading-snug">
              ℹ️ <strong>Phân loại kết quả (Xác nhận thủ công trong prototype):</strong> Ở hệ thống bệnh viện thực tế, các ngưỡng cảnh báo và giá trị nguy kịch (Panic values) sẽ được đối chiếu tự động với khoảng tham chiếu chuẩn của máy xét nghiệm LIS/PACS.
            </div>
          </div>

          {/* Kết quả chi tiết */}
          <div>
            <label
              htmlFor="ket_qua_chi_tiet"
              className="block font-semibold text-gray-700 mb-1"
            >
              Trị số xét nghiệm / Kết luận hình ảnh <span className="text-rose-500">*</span>
            </label>
            <textarea
              id="ket_qua_chi_tiet"
              rows={4}
              className="w-full rounded-lg border border-gray-300 p-2.5 text-xs focus:border-[#1F6F5C] focus:outline-none focus:ring-1 focus:ring-[#1F6F5C]"
              placeholder="Ví dụ: WBC: 7.2 G/L, RBC: 4.5 T/L, Hgb: 138 g/L. Hoặc: Không phát hiện tổn thương nhu mô phổi trên phim chụp tim phổi thẳng..."
              value={ketQuaChiTiet}
              onChange={(e) => setKetQuaChiTiet(e.target.value)}
              disabled={isSaving}
            />
          </div>

          {/* URL file đính kèm */}
          <div>
            <label
              htmlFor="tep_dinh_kem_url"
              className="block font-semibold text-gray-700 mb-1"
            >
              Link file đính kèm / Ảnh phim PACS (Tùy chọn)
            </label>
            <div className="relative">
              <input
                id="tep_dinh_kem_url"
                type="url"
                className="w-full rounded-lg border border-gray-300 pl-8 pr-3 py-2 text-xs focus:border-[#1F6F5C] focus:outline-none focus:ring-1 focus:ring-[#1F6F5C]"
                placeholder="https://storage.clinic.vn/labs/xquang-tim-phoi.jpg"
                value={tepDinhKemUrl}
                onChange={(e) => setTepDinhKemUrl(e.target.value)}
                disabled={isSaving}
              />
              <LinkIcon className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
            </div>
            {tepDinhKemUrl.trim() && isValidUrl(tepDinhKemUrl.trim()) && (
              <div className="mt-1 text-[11px] text-emerald-600 flex items-center gap-1 font-medium">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>URL hợp lệ. Bác sĩ và bệnh nhân có thể truy cập trực tiếp file.</span>
              </div>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-lg bg-[#1F6F5C] px-4 py-2 text-xs font-bold text-white hover:bg-[#185949] disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
          >
            {isSaving ? 'Đang lưu kết quả...' : 'Xác nhận lưu kết quả'}
          </button>
        </div>
      </div>
    </div>
  );
}
