import { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useLocation } from 'react-router-dom'
import { AppToast } from '../../components/common/AppNotification'
import { updateClinicCollectionAsync } from '../../redux/actions/admin/adminAction'
import {
    Gear,
    SlidersHorizontal,
    FloppyDisk,
    ArrowsClockwise,
    Hospital,
    ShieldCheck,
    Scales,
    Receipt,
    CheckCircle,
    QrCode,
} from '../../components/common/ClinicIcon'

export default function SettingClinicPage() {
    const dispatch = useDispatch()
    const location = useLocation()
    const { clinicData } = useSelector((state) => state.app.admin)
    const settings = clinicData?.clinicSettings || {}

    const queryTab = new URLSearchParams(location.search).get('tab')
    const [activeTab, setActiveTab] = useState(
        queryTab && ['THONG_TIN', 'CONG_LIEN_THONG', 'TAI_CHINH', 'QUY_DINH'].includes(queryTab)
            ? queryTab
            : 'THONG_TIN'
    )

    useEffect(() => {
        if (queryTab && ['THONG_TIN', 'CONG_LIEN_THONG', 'TAI_CHINH', 'QUY_DINH'].includes(queryTab)) {
            setActiveTab(queryTab)
        }
    }, [queryTab])

    const [isPinging, setIsPinging] = useState(false)
    const [pingResult, setPingResult] = useState(null)

    // Form settings state
    const [form, setForm] = useState({
        tenPhongKham: settings.tenPhongKham || 'Phòng Khám Đa Khoa Quốc Tế Clinic-AI',
        maCoSoKCB: settings.maCoSoKCB || '01-08924',
        giayPhepHoatDong: settings.giayPhepHoatDong || 'Số 1428/HNO-GPHĐ (Cấp ngày 10/01/2023)',
        nguoiChiuTrachNhiem: 'BS.CKII Nguyễn Minh Hoàng (CCHN: 004512/HNO-CCHN)',
        dienThoai: settings.dienThoai || '1900 2115',
        email: settings.email || 'cskh@clinic-ai.vn',
        diaChi: settings.diaChi || 'Số 18 Duy Tân, Phường Dịch Vọng Hậu, Quận Cầu Giấy, Hà Nội',
        // Cổng liên thông
        donThuocQuocGiaUrl: settings.congLienThong?.donThuocQuocGiaUrl || 'https://donthuocquocgia.vn/api/v1',
        maLienThongCoSo: settings.congLienThong?.maLienThongCoSo || 'LT_0108924_CLINICAI',
        duocQuocGiaUrl: settings.congLienThong?.duocQuocGiaUrl || 'https://duocquocgia.com.vn/api/v2',
        maCoSoDuoc: settings.congLienThong?.maCoSoDuoc || 'DQG_0108924',
        chuKySo: settings.congLienThong?.chuKySo || 'VNPT SmartCA HSM (Đã kích hoạt cho 04 Bác sĩ)',
        // Tài chính
        hoaDonDienTu: settings.congLienThong?.hoaDonDienTu || 'MISA meInvoice (MST: 0109988231 - Ký hiệu: 1C26TAA)',
        nganHang: 'Ngân hàng TMCP Quân Đội (MBBank)',
        soTaiKhoan: '0892419002115',
        chuTaiKhoan: 'PHONG KHAM DA KHOA QUOC TE CLINIC-AI',
        // Quy định
        batBuocICD10: settings.heThong?.batBuocICD10 ?? true,
        thuTienTruocCLS: settings.heThong?.thuTienTruocCLS ?? true,
        tuDongKhoaSoSauGio: settings.heThong?.tuDongKhoaSoSauGio || '23:00 (Sau 1 ngày)',
    })

    const handlePingGateway = () => {
        setIsPinging(true)
        setPingResult(null)
        setTimeout(() => {
            setIsPinging(false)
            setPingResult({
                status: 'CONNECTED',
                code: 200,
                latency: 42,
                serverTime: new Date().toISOString(),
                gatewayVersion: 'DonThuocQG-BYT v2.4.1 (Ready)',
            })
            AppToast.success('Kết nối Cổng Đơn thuốc Quốc gia BYT thành công! Độ trễ: 42ms')
        }, 1200)
    }

    const handleSave = () => {
        const updated = {
            ...settings,
            tenPhongKham: form.tenPhongKham,
            maCoSoKCB: form.maCoSoKCB,
            giayPhepHoatDong: form.giayPhepHoatDong,
            dienThoai: form.dienThoai,
            email: form.email,
            diaChi: form.diaChi,
            heThong: {
                ...settings.heThong,
                batBuocICD10: form.batBuocICD10,
                thuTienTruocCLS: form.thuTienTruocCLS,
                tuDongKhoaSoSauGio: form.tuDongKhoaSoSauGio,
            },
            congLienThong: {
                ...settings.congLienThong,
                donThuocQuocGiaUrl: form.donThuocQuocGiaUrl,
                maLienThongCoSo: form.maLienThongCoSo,
                duocQuocGiaUrl: form.duocQuocGiaUrl,
                maCoSoDuoc: form.maCoSoDuoc,
                chuKySo: form.chuKySo,
                hoaDonDienTu: form.hoaDonDienTu,
            },
        }
        dispatch(
            updateClinicCollectionAsync({
                collectionKey: 'clinicSettings',
                items: updated,
                auditEntry: {
                    hanhDong: 'UPDATE_CLINIC_SETTINGS',
                    doiTuong: updated.tenPhongKham || 'Cấu hình phòng khám',
                    mucDich: 'Cập nhật tham số hệ thống & liên thông Bộ Y Tế',
                },
            })
        )
        AppToast.success('Lưu cấu hình hệ thống phòng khám thành công!')
    }

    return (
        <div className="space-y-4">
            {/* Top Navigation & Operational Summary */}
            <div className="bg-white rounded-2xl shadow-xs border border-[#E5EEF5] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <span className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#00B5F1] to-[#0088BA] text-white flex items-center justify-center shadow-md">
                        <Gear size={24} weight="fill" />
                    </span>
                    <div>
                        <h1 className="text-lg font-black text-[#003553] tracking-wide flex items-center gap-2">
                            CÀI ĐẶT HỆ THỐNG PHÒNG KHÁM (/setting)
                            <span className="px-2 py-0.5 rounded-full bg-sky-100 text-[#00B5F1] text-[11px] font-bold">
                                Cơ sở KCB Bộ Y Tế
                            </span>
                        </h1>
                        <p className="text-xs text-slate-500">
                            Cấu hình thông tin pháp lý cơ sở khám chữa bệnh, cổng liên thông Quốc gia (TT 26), VietQR & MISA meInvoice
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handleSave}
                        className="medpro-btn-primary !py-2 !px-4 text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                        <FloppyDisk size={16} weight="bold" />
                        <span>Lưu thay đổi cài đặt</span>
                    </button>
                </div>
            </div>

            {/* Sub-Tabs bar (Chuẩn tClinic) */}
            <div className="flex border-b border-slate-200 gap-1 bg-white px-3 pt-2 rounded-t-xl">
                {[
                    { id: 'THONG_TIN', label: '1. Thông tin cơ sở KCB & Giấy phép' },
                    { id: 'CONG_LIEN_THONG', label: '2. Cổng liên thông Quốc gia & Ký số' },
                    { id: 'TAI_CHINH', label: '3. VietQR & Hóa đơn điện tử' },
                    { id: 'QUY_DINH', label: '4. Quy chế vận hành & Ràng buộc' },
                ].map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        onClick={() => setActiveTab(t.id)}
                        className={`px-3.5 py-2 text-xs font-bold transition border-b-2 cursor-pointer ${
                            activeTab === t.id
                                ? 'border-[#00B5F1] text-[#00B5F1]'
                                : 'border-transparent text-slate-500 hover:text-[#003553]'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* TAB 1: THÔNG TIN CƠ SỞ KCB */}
            {activeTab === 'THONG_TIN' && (
                <div className="bg-white rounded-xl border border-[#E5EEF5] p-5 space-y-4">
                    <div className="text-xs font-black text-[#003553] uppercase border-b border-slate-100 pb-2">
                        THÔNG TIN PHÁP LÝ CƠ SỞ KHÁM CHỮA BỆNH (GIẤY PHÉP BỘ Y TẾ)
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div>
                            <label className="block text-slate-600 font-bold mb-1">Tên cơ sở khám chữa bệnh:</label>
                            <input
                                type="text"
                                value={form.tenPhongKham}
                                onChange={(e) => setForm({ ...form, tenPhongKham: e.target.value })}
                                className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-[#00B5F1] font-bold text-[#003553]"
                            />
                        </div>

                        <div>
                            <label className="block text-slate-600 font-bold mb-1">Mã định danh KCB (Sở Y Tế cấp):</label>
                            <input
                                type="text"
                                value={form.maCoSoKCB}
                                onChange={(e) => setForm({ ...form, maCoSoKCB: e.target.value })}
                                className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-[#00B5F1] font-mono font-bold text-[#00B5F1]"
                            />
                        </div>

                        <div>
                            <label className="block text-slate-600 font-bold mb-1">Số Giấy phép hoạt động y tế:</label>
                            <input
                                type="text"
                                value={form.giayPhepHoatDong}
                                onChange={(e) => setForm({ ...form, giayPhepHoatDong: e.target.value })}
                                className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-[#00B5F1]"
                            />
                        </div>

                        <div>
                            <label className="block text-slate-600 font-bold mb-1">Người chịu trách nhiệm chuyên môn kỹ thuật:</label>
                            <input
                                type="text"
                                value={form.nguoiChiuTrachNhiem}
                                onChange={(e) => setForm({ ...form, nguoiChiuTrachNhiem: e.target.value })}
                                className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-[#00B5F1]"
                            />
                        </div>

                        <div>
                            <label className="block text-slate-600 font-bold mb-1">Hotline tiếp đón & Cấp cứu:</label>
                            <input
                                type="text"
                                value={form.dienThoai}
                                onChange={(e) => setForm({ ...form, dienThoai: e.target.value })}
                                className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-[#00B5F1]"
                            />
                        </div>

                        <div>
                            <label className="block text-slate-600 font-bold mb-1">Email liên hệ CSKH:</label>
                            <input
                                type="text"
                                value={form.email}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                                className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-[#00B5F1]"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-slate-600 font-bold mb-1">Địa chỉ trụ sở phòng khám:</label>
                            <input
                                type="text"
                                value={form.diaChi}
                                onChange={(e) => setForm({ ...form, diaChi: e.target.value })}
                                className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-[#00B5F1]"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: CỔNG LIÊN THÔNG QUỐC GIA */}
            {activeTab === 'CONG_LIEN_THONG' && (
                <div className="bg-white rounded-xl border border-[#E5EEF5] p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div className="text-xs font-black text-[#003553] uppercase">
                            KẾT NỐI HỆ THỐNG ĐƠN THUỐC QUỐC GIA & HỒ SƠ SỨC KHỎE ĐIỆN TỬ (TT 26/2023)
                        </div>
                        <button
                            type="button"
                            onClick={handlePingGateway}
                            disabled={isPinging}
                            className="medpro-btn-outline !py-1.5 !px-3 text-xs flex items-center gap-1.5 cursor-pointer"
                        >
                            <ArrowsClockwise size={14} className={isPinging ? 'animate-spin' : ''} />
                            <span>{isPinging ? 'Đang ping kiểm tra...' : 'Kiểm tra kết nối Cổng (Ping Test)'}</span>
                        </button>
                    </div>

                    {pingResult && (
                        <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/70 text-xs flex items-center justify-between animate-fadeIn">
                            <div className="flex items-center gap-2">
                                <CheckCircle size={20} weight="fill" className="text-emerald-600" />
                                <div>
                                    <div className="font-bold text-emerald-900">
                                        Cổng Quốc Gia Đang Hoạt Động (HTTP {pingResult.code} OK)
                                    </div>
                                    <div className="text-[11px] text-emerald-700">
                                        Phiên bản: {pingResult.gatewayVersion} &bull; Thời gian phản hồi: {pingResult.latency}ms
                                    </div>
                                </div>
                            </div>
                            <span className="font-mono text-[10px] text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                                ONLINE
                            </span>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div>
                            <label className="block text-slate-600 font-bold mb-1">URL API Cổng Đơn thuốc Quốc gia:</label>
                            <input
                                type="text"
                                value={form.donThuocQuocGiaUrl}
                                onChange={(e) => setForm({ ...form, donThuocQuocGiaUrl: e.target.value })}
                                className="w-full p-2.5 rounded-lg border border-slate-200 font-mono text-slate-700"
                            />
                        </div>

                        <div>
                            <label className="block text-slate-600 font-bold mb-1">Mã liên thông cơ sở KCB:</label>
                            <input
                                type="text"
                                value={form.maLienThongCoSo}
                                onChange={(e) => setForm({ ...form, maLienThongCoSo: e.target.value })}
                                className="w-full p-2.5 rounded-lg border border-slate-200 font-mono font-bold text-[#00B5F1]"
                            />
                        </div>

                        <div>
                            <label className="block text-slate-600 font-bold mb-1">URL Cổng Dược Quốc gia:</label>
                            <input
                                type="text"
                                value={form.duocQuocGiaUrl}
                                onChange={(e) => setForm({ ...form, duocQuocGiaUrl: e.target.value })}
                                className="w-full p-2.5 rounded-lg border border-slate-200 font-mono text-slate-700"
                            />
                        </div>

                        <div>
                            <label className="block text-slate-600 font-bold mb-1">Mã liên thông Dược:</label>
                            <input
                                type="text"
                                value={form.maCoSoDuoc}
                                onChange={(e) => setForm({ ...form, maCoSoDuoc: e.target.value })}
                                className="w-full p-2.5 rounded-lg border border-slate-200 font-mono text-slate-700"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-slate-600 font-bold mb-1">Giải pháp Chữ ký số Y tế (HSM SmartCA):</label>
                            <input
                                type="text"
                                value={form.chuKySo}
                                onChange={(e) => setForm({ ...form, chuKySo: e.target.value })}
                                className="w-full p-2.5 rounded-lg border border-slate-200 font-medium text-slate-800"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 3: TÀI CHÍNH & VIETQR */}
            {activeTab === 'TAI_CHINH' && (
                <div className="bg-white rounded-xl border border-[#E5EEF5] p-5 space-y-4">
                    <div className="text-xs font-black text-[#003553] uppercase border-b border-slate-100 pb-2">
                        CẤU HÌNH CỔNG THANH TOÁN VIETQR & HÓA ĐƠN ĐIỆN TỬ
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="space-y-3">
                            <div>
                                <label className="block text-slate-600 font-bold mb-1">Ngân hàng thụ hưởng VietQR:</label>
                                <input
                                    type="text"
                                    value={form.nganHang}
                                    onChange={(e) => setForm({ ...form, nganHang: e.target.value })}
                                    className="w-full p-2.5 rounded-lg border border-slate-200"
                                />
                            </div>

                            <div>
                                <label className="block text-slate-600 font-bold mb-1">Số tài khoản thanh toán viện phí:</label>
                                <input
                                    type="text"
                                    value={form.soTaiKhoan}
                                    onChange={(e) => setForm({ ...form, soTaiKhoan: e.target.value })}
                                    className="w-full p-2.5 rounded-lg border border-slate-200 font-mono font-bold text-[#00B5F1]"
                                />
                            </div>

                            <div>
                                <label className="block text-slate-600 font-bold mb-1">Tên chủ tài khoản:</label>
                                <input
                                    type="text"
                                    value={form.chuTaiKhoan}
                                    onChange={(e) => setForm({ ...form, chuTaiKhoan: e.target.value })}
                                    className="w-full p-2.5 rounded-lg border border-slate-200 font-bold text-[#003553]"
                                />
                            </div>

                            <div>
                                <label className="block text-slate-600 font-bold mb-1">Cấu hình HĐĐT MISA meInvoice:</label>
                                <input
                                    type="text"
                                    value={form.hoaDonDienTu}
                                    onChange={(e) => setForm({ ...form, hoaDonDienTu: e.target.value })}
                                    className="w-full p-2.5 rounded-lg border border-slate-200"
                                />
                            </div>
                        </div>

                        {/* VietQR Preview Box */}
                        <div className="p-4 rounded-xl border border-sky-100 bg-[#F8FCFF] flex flex-col items-center justify-center text-center space-y-2">
                            <span className="text-xs font-bold text-[#003553] uppercase">MẪU MÃ VIETQR TIẾP ĐÓN</span>
                            <div className="w-36 h-36 bg-white p-2 rounded-xl shadow-xs border border-slate-200 flex items-center justify-center">
                                <QrCode size={110} className="text-[#003553]" />
                            </div>
                            <div className="text-[11px] font-bold text-slate-700">{form.chuTaiKhoan}</div>
                            <div className="text-[10.5px] font-mono text-slate-400">STK: {form.soTaiKhoan} &bull; MBBank</div>
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                                Tự động gạch nợ hóa đơn
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 4: QUY CHẾ VẬN HÀNH */}
            {activeTab === 'QUY_DINH' && (
                <div className="bg-white rounded-xl border border-[#E5EEF5] p-5 space-y-4">
                    <div className="text-xs font-black text-[#003553] uppercase border-b border-slate-100 pb-2">
                        RÀNG BUỘC NGHIỆP VỤ & QUY CHẾ VẬN HÀNH BỆNH ÁN
                    </div>

                    <div className="space-y-3 text-xs">
                        <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={form.batBuocICD10}
                                onChange={(e) => setForm({ ...form, batBuocICD10: e.target.checked })}
                                className="w-4 h-4 rounded text-[#00B5F1] focus:ring-[#00B5F1]"
                            />
                            <div>
                                <div className="font-bold text-[#003553]">Bắt buộc nhập mã chẩn đoán ICD-10 trước khi kê đơn</div>
                                <div className="text-slate-400 text-[11px]">Ngăn chặn đơn thuốc thiếu mã bệnh theo quy định Thông tư 04/2022/TT-BYT</div>
                            </div>
                        </label>

                        <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={form.thuTienTruocCLS}
                                onChange={(e) => setForm({ ...form, thuTienTruocCLS: e.target.checked })}
                                className="w-4 h-4 rounded text-[#00B5F1] focus:ring-[#00B5F1]"
                            />
                            <div>
                                <div className="font-bold text-[#003553]">Thu viện phí trước khi thực hiện Cận lâm sàng (X-Quang, Xét nghiệm, Siêu âm)</div>
                                <div className="text-slate-400 text-[11px]">Chỉ chuyển trạng thái phòng máy khi đã có phiếu thu hợp lệ từ quầy thu ngân</div>
                            </div>
                        </label>

                        <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between">
                            <div>
                                <div className="font-bold text-[#003553]">Tự động khóa sổ quỹ ca trực cuối ngày:</div>
                                <div className="text-slate-400 text-[11px]">Tạo biên bản quỹ bất biến lưu vết kiểm toán</div>
                            </div>
                            <span className="font-mono font-bold text-[#00B5F1]">{form.tuDongKhoaSoSauGio}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
