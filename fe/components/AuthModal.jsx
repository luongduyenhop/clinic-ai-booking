import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Lock, Mail, Phone, ShieldCheck, ArrowRight } from 'lucide-react';
import ApiService from '../services/api';

export default function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  const router = useRouter();

  const [authMode, setAuthMode] = useState('login'); // 'login', 'register', 'otp'
  const [loginMethod, setLoginMethod] = useState('password'); // 'password', 'phone'

  // Form Fields
  const [emailOrPhone, setEmailOrPhone] = useState('patient@test.com');
  const [password, setPassword] = useState('Patient@123456');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('0988888888');
  const [otpCode, setOtpCode] = useState('123456');
  const [role, setRole] = useState('PATIENT');

  // UI States
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [otpSentMessage, setOtpSentMessage] = useState('');

  if (!isOpen) return null;

  // Auto-redirect logic based on role & query param
  const redirectAfterLogin = (userRole) => {
    let target = null;
    try {
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const redirectParam = urlParams.get('redirect');
        if (redirectParam && redirectParam.startsWith('/') && !redirectParam.startsWith('//')) {
          target = redirectParam;
        }
      }
    } catch (e) {}

    if (!target) {
      switch (userRole) {
        case 'DOCTOR':
          target = '/doctor/dashboard';
          break;
        case 'RECEPTIONIST':
          target = '/reception';
          break;
        case 'ADMIN':
          target = '/admin/dashboard';
          break;
        case 'PATIENT':
        default:
          target = '/patient/dashboard';
          break;
      }
    }

    if (typeof window !== 'undefined' && window.location.pathname === target) {
      return; // Prevent redirect loop
    }
    router.push(target);
  };

  const handleAuthDone = (user) => {
    if (onAuthSuccess) onAuthSuccess(user);
    if (onClose) onClose();
    if (user?.role) {
      redirectAfterLogin(user.role);
    }
  };

  // Quick Demo Account Pre-fill
  const fillDemoAccount = (demoRole) => {
    setFormError('');
    if (demoRole === 'PATIENT') {
      setEmailOrPhone('patient@test.com');
      setPassword('Patient@123456');
    } else if (demoRole === 'RECEPTIONIST') {
      setEmailOrPhone('letan@clinic.com');
      setPassword('LeTan@123456');
    } else if (demoRole === 'DOCTOR') {
      setEmailOrPhone('an.doctor@clinic.com');
      setPassword('Doctor@123456');
    } else if (demoRole === 'ADMIN') {
      setEmailOrPhone('admin@clinic.com');
      setPassword('Admin@123456');
    }
  };

  // Handle Login Password Submission
  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setFormError('');

    try {
      const res = await ApiService.loginPassword(emailOrPhone, password);
      handleAuthDone(res.user);
    } catch (err) {
      setFormError(err.message || 'Thông tin đăng nhập không chính xác. Vui lòng kiểm tra lại email hoặc mật khẩu.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Request OTP
  const handleRequestOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    setFormError('');

    try {
      const res = await ApiService.requestOTP(phone);
      setOtpSentMessage(res.message || 'Mã OTP thử nghiệm đã được gửi.');
      setAuthMode('otp');
    } catch (err) {
      setFormError(err.message || 'Không thể gửi mã OTP. Vui lòng kiểm tra lại số điện thoại.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Verify OTP
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    setFormError('');

    try {
      const res = await ApiService.verifyOTP(phone, otpCode);
      handleAuthDone(res.user);
    } catch (err) {
      setFormError(err.message || 'Mã OTP không hợp lệ hoặc đã hết hạn (Mã mặc định: 123456).');
    } finally {
      setLoading(false);
    }
  };

  // Handle Register Submission
  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setFormError('');

    try {
      const res = await ApiService.register({
        full_name: fullName,
        email: emailOrPhone.includes('@') ? emailOrPhone : null,
        phone: !emailOrPhone.includes('@') ? emailOrPhone : phone,
        password: password,
        role: role
      });
      handleAuthDone(res.user);
    } catch (err) {
      setFormError(err.message || 'Đăng ký không thành công. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Google OAuth Mock Login
  const handleGoogleMockLogin = async () => {
    setLoading(true);
    setFormError('');

    try {
      const res = await ApiService.googleLogin('user.google@gmail.com', 'Nguyễn Google User');
      handleAuthDone(res.user);
    } catch (err) {
      setFormError('Không thể kết nối dịch vụ Google. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#1C1B19]/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#FFFFFF] border border-[#E4E1D8] rounded-[12px] max-w-md w-full p-6 shadow-lg space-y-5 relative text-[#1C1B19]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-[#6B6A65] hover:text-[#1C1B19] hover:bg-[#F7F5F0] transition"
          aria-label="Đóng"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-left space-y-1">
          <div className="w-10 h-10 rounded-lg bg-[#DCEAE6] text-[#1F6F5C] flex items-center justify-center mb-2">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-semibold text-[#1C1B19]">
            {authMode === 'login' && 'Đăng nhập hệ thống'}
            {authMode === 'register' && 'Tạo tài khoản mới'}
            {authMode === 'otp' && 'Xác thực mã OTP'}
          </h2>
          <p className="text-sm text-[#6B6A65]">Đăng nhập để đặt lịch khám và xem lịch sử khám bệnh</p>
        </div>

        {/* Quick Demo Login Fill Buttons */}
        {authMode === 'login' && (
          <div className="bg-[#F7F5F0] rounded-lg p-3 border border-[#E4E1D8] space-y-2">
            <span className="text-xs text-[#6B6A65] font-medium block">
              Chọn tài khoản thử nghiệm nhanh:
            </span>
            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => fillDemoAccount('PATIENT')}
                className="px-2 py-1.5 rounded-md bg-[#DCEAE6] hover:bg-[#cbe2dc] text-[#1F6F5C] text-xs font-medium border border-[#b8d9d0] transition text-center"
              >
                Bệnh nhân
              </button>
              <button
                type="button"
                onClick={() => fillDemoAccount('RECEPTIONIST')}
                className="px-2 py-1.5 rounded-md bg-[#E0E7FF] hover:bg-[#c7d2fe] text-[#4338CA] text-xs font-medium border border-[#c7d2fe] transition text-center"
              >
                Điều dưỡng
              </button>
              <button
                type="button"
                onClick={() => fillDemoAccount('DOCTOR')}
                className="px-2 py-1.5 rounded-md bg-[#FBEACB] hover:bg-[#f7dfb0] text-[#B45309] text-xs font-medium border border-[#ebd095] transition text-center"
              >
                Bác sĩ
              </button>
              <button
                type="button"
                onClick={() => fillDemoAccount('ADMIN')}
                className="px-2 py-1.5 rounded-md bg-[#EFECE6] hover:bg-[#e4dfd5] text-[#1C1B19] text-xs font-medium border border-[#E4E1D8] transition text-center"
              >
                Quản trị
              </button>
            </div>
          </div>
        )}

        {/* Form Validation Error per design.md (Uses --warning-form #B45309, NOT --danger) */}
        {formError && (
          <div className="p-3 rounded-md bg-[#FDF6B2]/40 border border-[#B45309]/30 text-[#B45309] text-xs font-medium">
            {formError}
          </div>
        )}

        {/* Sent OTP Message */}
        {otpSentMessage && authMode === 'otp' && (
          <div className="p-3 rounded-md bg-[#DCEAE6] border border-[#1F6F5C]/30 text-[#1F6F5C] text-xs">
            {otpSentMessage} (Mã thử nghiệm: <strong>123456</strong>)
          </div>
        )}

        {/* Method Switcher for Login */}
        {authMode === 'login' && (
          <div className="flex rounded-md bg-[#F7F5F0] p-1 text-xs font-medium border border-[#E4E1D8]">
            <button
              type="button"
              onClick={() => setLoginMethod('password')}
              className={`flex-1 py-1.5 rounded-sm transition ${loginMethod === 'password' ? 'bg-[#FFFFFF] text-[#1F6F5C] shadow-sm font-semibold' : 'text-[#6B6A65] hover:text-[#1C1B19]'}`}
            >
              Email / Mật khẩu
            </button>
            <button
              type="button"
              onClick={() => setLoginMethod('phone')}
              className={`flex-1 py-1.5 rounded-sm transition ${loginMethod === 'phone' ? 'bg-[#FFFFFF] text-[#1F6F5C] shadow-sm font-semibold' : 'text-[#6B6A65] hover:text-[#1C1B19]'}`}
            >
              Số điện thoại & OTP
            </button>
          </div>
        )}

        {/* Password Login Form */}
        {authMode === 'login' && loginMethod === 'password' && (
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#1C1B19]">Email hoặc Số điện thoại</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#6B6A65] absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={emailOrPhone}
                  onChange={(e) => setEmailOrPhone(e.target.value)}
                  className="w-full bg-[#FFFFFF] border border-[#E4E1D8] rounded-md pl-9 pr-3 py-2 text-sm text-[#1C1B19] focus:outline-none focus:border-[#1F6F5C]"
                  placeholder="patient@gmail.com"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-[#1C1B19]">Mật khẩu</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#6B6A65] absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#FFFFFF] border border-[#E4E1D8] rounded-md pl-9 pr-3 py-2 text-sm text-[#1C1B19] focus:outline-none focus:border-[#1F6F5C]"
                  placeholder="Mật khẩu"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-md bg-[#1F6F5C] hover:bg-[#175748] text-white font-medium text-sm transition flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <span>{loading ? 'Đang xác thực...' : 'Đăng nhập'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* Phone OTP Login Form */}
        {authMode === 'login' && loginMethod === 'phone' && (
          <form onSubmit={handleRequestOTP} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#1C1B19]">Số điện thoại</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-[#6B6A65] absolute left-3 top-3" />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-[#FFFFFF] border border-[#E4E1D8] rounded-md pl-9 pr-3 py-2 text-sm text-[#1C1B19] focus:outline-none focus:border-[#1F6F5C]"
                  placeholder="0988888888"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-md bg-[#1F6F5C] hover:bg-[#175748] text-white font-medium text-sm transition"
            >
              {loading ? 'Đang gửi...' : 'Gửi mã OTP qua SMS'}
            </button>
          </form>
        )}

        {/* OTP Input Form */}
        {authMode === 'otp' && (
          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#1C1B19]">Mã OTP (Mã thử nghiệm: 123456)</label>
              <input
                type="text"
                required
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                className="w-full bg-[#FFFFFF] border border-[#1F6F5C] rounded-md px-3 py-2.5 text-center text-lg font-mono font-bold tracking-widest text-[#1F6F5C] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-md bg-[#2F8F5B] hover:bg-[#25754a] text-white font-medium text-sm transition"
            >
              {loading ? 'Đang kiểm tra...' : 'Xác nhận mã OTP'}
            </button>
          </form>
        )}

        {/* Register Form */}
        {authMode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-3.5">
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#1C1B19]">Họ và tên</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-[#FFFFFF] border border-[#E4E1D8] rounded-md px-3 py-2 text-sm text-[#1C1B19] focus:outline-none"
                placeholder="Nguyễn Văn An"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-[#1C1B19]">Email hoặc Số điện thoại</label>
              <input
                type="text"
                required
                value={emailOrPhone}
                onChange={(e) => setEmailOrPhone(e.target.value)}
                className="w-full bg-[#FFFFFF] border border-[#E4E1D8] rounded-md px-3 py-2 text-sm text-[#1C1B19] focus:outline-none"
                placeholder="email@example.com hoặc 0988888888"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-[#1C1B19]">Mật khẩu</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#FFFFFF] border border-[#E4E1D8] rounded-md px-3 py-2 text-sm text-[#1C1B19] focus:outline-none"
                placeholder="Tối thiểu 6 ký tự"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-[#1C1B19]">Vai trò người dùng</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full bg-[#FFFFFF] border border-[#E4E1D8] rounded-md px-3 py-2 text-sm text-[#1C1B19] focus:outline-none"
              >
                <option value="PATIENT">Bệnh nhân</option>
                <option value="DOCTOR">Bác sĩ</option>
                <option value="ADMIN">Quản trị viên</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-md bg-[#1F6F5C] hover:bg-[#175748] text-white font-medium text-sm transition"
            >
              {loading ? 'Đang xử lý...' : 'Tạo tài khoản'}
            </button>
          </form>
        )}

        {/* Google OAuth Mock Button */}
        {authMode === 'login' && (
          <div className="space-y-3 pt-2 border-t border-[#E4E1D8]">
            <button
              type="button"
              onClick={handleGoogleMockLogin}
              className="w-full py-2 rounded-md bg-[#F7F5F0] hover:bg-[#EFECE6] border border-[#E4E1D8] text-[#1C1B19] text-xs font-medium flex items-center justify-center space-x-2 transition"
            >
              <span className="font-bold text-[#1F6F5C]">G</span>
              <span>Đăng nhập với Google</span>
            </button>
          </div>
        )}

        {/* Mode Switch Footer */}
        <div className="text-center pt-2 text-xs text-[#6B6A65]">
          {authMode === 'login' ? (
            <p>
              Chưa có tài khoản?{' '}
              <button
                type="button"
                onClick={() => { setAuthMode('register'); setFormError(''); }}
                className="text-[#1F6F5C] hover:underline font-semibold"
              >
                Đăng ký ngay
              </button>
            </p>
          ) : (
            <p>
              Đã có tài khoản?{' '}
              <button
                type="button"
                onClick={() => { setAuthMode('login'); setFormError(''); }}
                className="text-[#1F6F5C] hover:underline font-semibold"
              >
                Quay lại đăng nhập
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
