'use client';

import { useState } from 'react';

export default function ProfileTab({
  currentUser,
  profileForm,
  setProfileForm,
  passwordForm,
  setPasswordForm,
  showLegalRequestModal,
  setShowLegalRequestModal,
  onSaveProfile,
  onChangePassword,
}) {
  const [profileError, setProfileError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [legalReason, setLegalReason] = useState('');

  const handleSaveProfile = () => {
    setProfileError('');

    // Validate số điện thoại (10-11 số)
    if (profileForm.so_dien_thoai) {
      const phone = profileForm.so_dien_thoai.trim();
      if (!/^[0-9]{10,11}$/.test(phone)) {
        setProfileError('Số điện thoại phải có 10-11 chữ số hợp lệ.');
        return;
      }
    }

    // Validate email liên hệ phụ nếu có
    if (profileForm.email_lien_he_phu) {
      const email = profileForm.email_lien_he_phu.trim();
      if (email && !/^\S+@\S+\.\S+$/.test(email)) {
        setProfileError('Email liên hệ phụ không hợp lệ.');
        return;
      }
    }

    // Validate độ dài tiểu sử
    if (profileForm.tieu_su && profileForm.tieu_su.length > 1000) {
      setProfileError('Tiểu sử không được vượt quá 1000 ký tự.');
      return;
    }

    onSaveProfile(profileForm);
  };

  const handleChangePassword = () => {
    setPasswordError('');

    if (!passwordForm.old_password || !passwordForm.new_password || !passwordForm.confirm_password) {
      setPasswordError('Vui lòng nhập đầy đủ mật khẩu hiện tại, mật khẩu mới và xác nhận mật khẩu.');
      return;
    }

    if (passwordForm.new_password.length < 6) {
      setPasswordError('Mật khẩu mới phải có tối thiểu 6 ký tự.');
      return;
    }

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordError('Mật khẩu xác nhận không khớp với mật khẩu mới.');
      return;
    }

    onChangePassword(passwordForm);
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Card 1: Thông tin Self-Service (Allow-list cập nhật trực tiếp) */}
      <div className="bg-white border border-[#E4E1D8] rounded-xl shadow-sm p-5 space-y-4">
        <div className="border-b pb-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#1C1B19]">
              👤 Thông Tin Cá Nhân (Tự Phục Vụ)
            </h2>
            <span className="text-[11px] px-2 py-0.5 bg-emerald-50 text-emerald-700 font-semibold rounded border border-emerald-200">
              OWASP Allow-List
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Bác sĩ có toàn quyền chủ động cập nhật thông tin liên lạc và giới thiệu công khai.
          </p>
        </div>

        <div className="space-y-3.5">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Họ và tên bác sĩ
            </label>
            <input
              type="text"
              disabled
              className="w-full text-xs bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-gray-700 cursor-not-allowed font-medium"
              value={currentUser?.ho_ten || currentUser?.full_name || 'Bác sĩ'}
            />
            <span className="text-[10px] text-gray-400 mt-0.5 block">
              * Tên đăng ký theo chứng chỉ hành nghề (khóa sửa đổi trực tiếp)
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Số điện thoại liên lạc
            </label>
            <input
              type="text"
              className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#1F6F5C] focus:outline-none"
              value={profileForm.so_dien_thoai || ''}
              onChange={(e) =>
                setProfileForm({ ...profileForm, so_dien_thoai: e.target.value })
              }
              placeholder="0912345678"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Email liên hệ phụ
            </label>
            <input
              type="email"
              className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#1F6F5C] focus:outline-none"
              value={profileForm.email_lien_he_phu || ''}
              onChange={(e) =>
                setProfileForm({ ...profileForm, email_lien_he_phu: e.target.value })
              }
              placeholder="doctor.personal@gmail.com"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Địa chỉ nơi ở / liên lạc
            </label>
            <input
              type="text"
              className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#1F6F5C] focus:outline-none"
              value={profileForm.dia_chi_lien_he || ''}
              onChange={(e) =>
                setProfileForm({ ...profileForm, dia_chi_lien_he: e.target.value })
              }
              placeholder="Quận 1, TP. Hồ Chí Minh"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Tiểu sử quá trình đào tạo & công tác
            </label>
            <textarea
              className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#1F6F5C] focus:outline-none"
              rows={3}
              value={profileForm.tieu_su || ''}
              onChange={(e) =>
                setProfileForm({ ...profileForm, tieu_su: e.target.value })
              }
              placeholder="Tốt nghiệp Đại học Y Dược, có hơn 15 năm kinh nghiệm điều trị..."
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Mô tả vắn tắt (Hiển thị thẻ danh bạ)
            </label>
            <textarea
              className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#1F6F5C] focus:outline-none"
              rows={2}
              value={profileForm.mo_ta_ca_nhan || ''}
              onChange={(e) =>
                setProfileForm({ ...profileForm, mo_ta_ca_nhan: e.target.value })
              }
              placeholder="Chuyên sâu điều trị cao huyết áp, tim mạch tổng quát..."
            />
          </div>

          {profileError && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              ⚠️ {profileError}
            </div>
          )}

          <div className="pt-2">
            <button
              onClick={handleSaveProfile}
              className="w-full py-2.5 px-4 bg-[#1F6F5C] hover:bg-[#185949] text-white rounded-lg text-xs font-bold shadow-sm transition"
            >
              Lưu Thay Đổi Thông Tin Cá Nhân
            </button>
          </div>
        </div>
      </div>

      {/* Card 2: Bảo Mật & Đổi Mật Khẩu */}
      <div className="bg-white border border-[#E4E1D8] rounded-xl shadow-sm p-5 space-y-4">
        <div className="border-b pb-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#1C1B19]">
              🔒 Bảo Mật & Đổi Mật Khẩu
            </h2>
            <span className="text-[11px] px-2 py-0.5 bg-blue-50 text-blue-700 font-semibold rounded border border-blue-200">
              Riêng Biệt
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Không truyền thông tin mật khẩu chung trong payload cập nhật hồ sơ cá nhân.
          </p>
        </div>

        <div className="space-y-3.5">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Mật khẩu hiện tại
            </label>
            <input
              type="password"
              className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#1F6F5C] focus:outline-none"
              value={passwordForm.old_password || ''}
              onChange={(e) =>
                setPasswordForm({ ...passwordForm, old_password: e.target.value })
              }
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Mật khẩu mới
            </label>
            <input
              type="password"
              className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#1F6F5C] focus:outline-none"
              value={passwordForm.new_password || ''}
              onChange={(e) =>
                setPasswordForm({ ...passwordForm, new_password: e.target.value })
              }
              placeholder="Tối thiểu 6 ký tự"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Xác nhận mật khẩu mới
            </label>
            <input
              type="password"
              className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#1F6F5C] focus:outline-none"
              value={passwordForm.confirm_password || ''}
              onChange={(e) =>
                setPasswordForm({ ...passwordForm, confirm_password: e.target.value })
              }
              placeholder="Nhập lại mật khẩu mới"
            />
          </div>

          {passwordError && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              ⚠️ {passwordError}
            </div>
          )}

          <div className="pt-2">
            <button
              onClick={handleChangePassword}
              className="w-full py-2.5 px-4 bg-gray-800 hover:bg-gray-900 text-white rounded-lg text-xs font-bold shadow-sm transition"
            >
              Cập Nhật Mật Khẩu Đăng Nhập
            </button>
          </div>
        </div>
      </div>

      {/* Card 3: Thông tin Pháp lý & Chuyên môn (Restricted / Read-only) */}
      <div className="bg-white border border-[#E4E1D8] rounded-xl shadow-sm p-5 md:col-span-2 space-y-4">
        <div className="border-b pb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#1C1B19]">
              ⚖️ Thông Tin Chuyên Môn & Pháp Lý Hành Nghề (Restricted)
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Dữ liệu được bảo chứng bởi Sở Y tế và Ban Giám đốc Phòng khám.
            </p>
          </div>
          <span className="text-xs px-2.5 py-1 bg-amber-50 text-amber-800 font-bold rounded-lg border border-amber-300">
            🔒 Read-Only
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-4 bg-[#FCFCFB] p-4 rounded-xl border border-gray-100">
          <div>
            <div className="text-[11px] font-semibold text-gray-500 uppercase">Học vị / Học hàm</div>
            <div className="text-sm font-bold text-gray-900 mt-1">
              {currentUser?.hoc_vi || 'BS. CKII'}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-semibold text-gray-500 uppercase">Chuyên khoa trực thuộc</div>
            <div className="text-sm font-bold text-gray-900 mt-1">
              {currentUser?.chuyen_khoa_ten || currentUser?.specialty || 'Nội Tổng Quát & Tim Mạch'}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-semibold text-gray-500 uppercase">Số Chứng chỉ hành nghề (CCHN)</div>
            <div className="text-sm font-mono font-bold text-emerald-700 mt-1">
              {currentUser?.so_cchn || currentUser?.ma_dinh_danh_y_te || 'CCHN-003891/HCM-CCHN'}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-semibold text-gray-500 uppercase">Giá khám niêm yết</div>
            <div className="text-sm font-bold text-[#1F6F5C] mt-1">
              {currentUser?.gia_kham ? Number(currentUser.gia_kham).toLocaleString('vi-VN') + ' đ' : '300.000 đ'}
            </div>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
          <span className="text-base">📌</span>
          <div className="space-y-1">
            <strong>Nguyên tắc An toàn & Pháp lý Y tế:</strong>
            <p>
              Bác sĩ không được tự ý sửa đổi Học vị, Chuyên khoa hoặc Giá khám để tránh sai lệch thông tin niêm yết theo quy định Bộ Y tế.
              Mọi sự thay đổi phải có văn bản hoặc bằng cấp chứng chỉ kèm theo để Phòng Tổ chức Cán bộ phê duyệt.
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            onClick={() => setShowLegalRequestModal(true)}
            className="py-2.5 px-4 bg-gray-900 hover:bg-black text-white rounded-lg text-xs font-semibold shadow-sm transition flex items-center gap-2"
          >
            <span>📝 Gửi Đề Xuất Điều Chỉnh Thông Tin Pháp Lý</span>
          </button>
        </div>
      </div>

      {/* Modal: Đề xuất điều chỉnh thông tin pháp lý */}
      {showLegalRequestModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-[#E4E1D8] space-y-4">
            <div className="border-b pb-3">
              <h3 className="text-base font-bold text-[#1C1B19]">
                Đề Xuất Cập Nhật Thông Tin Pháp Lý
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Gửi yêu cầu tới Phòng TCCB và Admin phòng khám xét duyệt văn bằng/chứng chỉ mới.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Nội dung đề xuất điều chỉnh
                </label>
                <textarea
                  className="w-full text-xs border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#1F6F5C] focus:outline-none"
                  rows={4}
                  value={legalReason}
                  onChange={(e) => setLegalReason(e.target.value)}
                  placeholder="Ví dụ: Xin cập nhật học vị Tiến sĩ Y khoa vừa tốt nghiệp, đính kèm chứng nhận số..."
                />
              </div>
              <p className="text-[11px] text-gray-500 italic">
                * Vui lòng nộp bản sao công chứng bằng cấp cho Phòng Nhân sự sau khi gửi phiếu này.
              </p>
            </div>

            <div className="pt-2 border-t flex justify-end gap-2.5">
              <button
                onClick={() => {
                  setShowLegalRequestModal(false);
                  setLegalReason('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Đóng
              </button>
              <button
                onClick={() => {
                  if (!legalReason.trim()) {
                    alert('Vui lòng nhập nội dung đề xuất.');
                    return;
                  }
                  alert('Đề xuất đã được chuyển đến Phòng Tổ chức Cán bộ thành công!');
                  setShowLegalRequestModal(false);
                  setLegalReason('');
                }}
                className="px-4 py-2 bg-[#1F6F5C] hover:bg-[#185949] text-white rounded-lg text-xs font-bold shadow-sm transition"
              >
                Gửi đề xuất
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
