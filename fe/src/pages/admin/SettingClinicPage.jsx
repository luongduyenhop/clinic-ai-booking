import { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useLocation } from 'react-router-dom'
import { AppToast } from '../../components/common/AppNotification'
import { updateClinicCollectionAsync } from '../../redux/actions/admin/adminAction'
import {
    Gear,
    SlidersHorizontal,
    FloppyDisk,
    Hospital,
    ShieldCheck,
    Scales,
    Receipt,
    QrCode,
} from '../../components/common/ClinicIcon'

export default function SettingClinicPage() {
    const dispatch = useDispatch()
    const location = useLocation()
    const { clinicData } = useSelector((state) => state.app.admin)
    const savedSettings = clinicData?.clinicSettings || {}
    const settings = savedSettings.is_synthetic === true || String(savedSettings.data_classification || '').startsWith('SYNTHETIC')
        ? {}
        : savedSettings

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

    // Form settings state
    const [form, setForm] = useState({
        tenPhongKham: settings.tenPhongKham || '',
        maCoSoKCB: settings.maCoSoKCB || '',
        giayPhepHoatDong: settings.giayPhepHoatDong || '',
        nguoiChiuTrachNhiem: settings.nguoiChiuTrachNhiem || '',
        dienThoai: settings.dienThoai || '',
        email: settings.email || '',
        diaChi: settings.diaChi || '',
        // Cổng liên thông
        donThuocQuocGiaUrl: settings.congLienThong?.donThuocQuocGiaUrl || '',
        maLienThongCoSo: settings.congLienThong?.maLienThongCoSo || '',
        duocQuocGiaUrl: settings.congLienThong?.duocQuocGiaUrl || '',
        maCoSoDuoc: settings.congLienThong?.maCoSoDuoc || '',
        chuKySo: settings.congLienThong?.chuKySo || '',
        // Tài chính
        hoaDonDienTu: settings.congLienThong?.hoaDonDienTu || '',
        bankBin: settings.bankInfo?.bankBin || '',
        nganHang: settings.bankInfo?.bankName || '',
        soTaiKhoan: settings.bankInfo?.accountNumber || '',
        chuTaiKhoan: settings.bankInfo?.accountName || '',
        // Quy định
        batBuocICD10: settings.heThong?.batBuocICD10 ?? true,
        thuTienTruocCLS: settings.heThong?.thuTienTruocCLS ?? true,
        tuDongKhoaSoSauGio: settings.heThong?.tuDongKhoaSoSauGio || '23:00 (Sau 1 ngày)',
    })

    useEffect(() => {
        if (clinicData?.clinicSettings) {
            const rawSettings = clinicData.clinicSettings
            const s = rawSettings.is_synthetic === true || String(rawSettings.data_classification || '').startsWith('SYNTHETIC')
                ? {}
                : rawSettings
            setForm((prev) => ({
                ...prev,
                tenPhongKham: s.tenPhongKham || '',
                maCoSoKCB: s.maCoSoKCB || '',
                giayPhepHoatDong: s.giayPhepHoatDong || '',
                nguoiChiuTrachNhiem: s.nguoiChiuTrachNhiem || '',
                dienThoai: s.dienThoai || '',
                email: s.email || '',
                diaChi: s.diaChi || '',
                donThuocQuocGiaUrl: s.congLienThong?.donThuocQuocGiaUrl || '',
                maLienThongCoSo: s.congLienThong?.maLienThongCoSo || '',
                duocQuocGiaUrl: s.congLienThong?.duocQuocGiaUrl || '',
                maCoSoDuoc: s.congLienThong?.maCoSoDuoc || '',
                chuKySo: s.congLienThong?.chuKySo || '',
                hoaDonDienTu: s.congLienThong?.hoaDonDienTu || '',
                bankBin: s.bankInfo?.bankBin || '',
                nganHang: s.bankInfo?.bankName || '',
                soTaiKhoan: s.bankInfo?.accountNumber || '',
                chuTaiKhoan: s.bankInfo?.accountName || '',
                batBuocICD10: s.heThong?.batBuocICD10 ?? prev.batBuocICD10,
                thuTienTruocCLS: s.heThong?.thuTienTruocCLS ?? prev.thuTienTruocCLS,
                tuDongKhoaSoSauGio: s.heThong?.tuDongKhoaSoSauGio || prev.tuDongKhoaSoSauGio,
            }))
        }
    }, [clinicData?.clinicSettings])

    const handleSave = async () => {
        const updated = {
            ...settings,
            tenPhongKham: form.tenPhongKham,
            maCoSoKCB: form.maCoSoKCB,
            giayPhepHoatDong: form.giayPhepHoatDong,
            nguoiChiuTrachNhiem: form.nguoiChiuTrachNhiem,
            dienThoai: form.dienThoai,
            email: form.email,
            diaChi: form.diaChi,
            bankInfo: {
                ...settings.bankInfo,
                bankBin: form.bankBin,
                bankName: form.nganHang,
                accountNumber: form.soTaiKhoan,
                accountName: form.chuTaiKhoan,
            },
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
        try {
            await dispatch(
                updateClinicCollectionAsync({
                    collectionKey: 'clinicSettings',
                    items: updated,
                    auditEntry: {
                        hanhDong: 'UPDATE_CLINIC_SETTINGS',
                        doiTuong: updated.tenPhongKham || 'Cấu hình phòng khám',
                        mucDich: 'Cập nhật tham số hệ thống & liên thông Bộ Y Tế',
                    },
                })
            ).unwrap()
            AppToast.success('Lưu cấu hình hệ thống phòng khám thành công!')
        } catch {
            AppToast.error('Không thể lưu cấu hình phòng khám. Vui lòng thử lại.')
        }
    }

    return (
        <div className="space-y-4">
            {/* Top Navigation & Operational Summary */}
            <div className="bg-white rounded-2xl shadow-xs border border-[#E5EEF5] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <span className="w-11 h-11 rounded-2xl bg-[#0A5878] text-white flex items-center justify-center">
                        <Gear size={24} weight="fill" />
                    </span>
                    <div>
                        <h1 className="text-lg font-black text-[#003553] tracking-wide flex items-center gap-2">
                            CÀI ĐẶT HỆ THỐNG PHÒNG KHÁM (/setting)
                            <span className="px-2 py-0.5 rounded-full bg-sky-100 text-[#00B5F1] text-[11px] font-bold">
                                Thông tin cơ sở
                            </span>
                        </h1>
                        <p className="text-xs text-slate-500">
                            Thông tin cơ sở khám chữa bệnh và cấu hình kết nối hệ thống
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
                                placeholder="Chưa cấu hình"
                                className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-[#00B5F1] font-bold text-[#003553]"
                            />
                        </div>

                        <div>
                            <label className="block text-slate-600 font-bold mb-1">Mã định danh KCB (Sở Y Tế cấp):</label>
                            <input
                                type="text"
                                value={form.maCoSoKCB}
                                onChange={(e) => setForm({ ...form, maCoSoKCB: e.target.value })}
                                placeholder="Chưa cấu hình"
                                className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-[#00B5F1] font-mono font-bold text-[#00B5F1]"
                            />
                        </div>

                        <div>
                            <label className="block text-slate-600 font-bold mb-1">Số Giấy phép hoạt động y tế:</label>
                            <input
                                type="text"
                                value={form.giayPhepHoatDong}
                                onChange={(e) => setForm({ ...form, giayPhepHoatDong: e.target.value })}
                                placeholder="Chưa cấu hình"
                                className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-[#00B5F1]"
                            />
                        </div>

                        <div>
                            <label className="block text-slate-600 font-bold mb-1">Người chịu trách nhiệm chuyên môn kỹ thuật:</label>
                            <input
                                type="text"
                                value={form.nguoiChiuTrachNhiem}
                                onChange={(e) => setForm({ ...form, nguoiChiuTrachNhiem: e.target.value })}
                                placeholder="Chưa cấu hình"
                                className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-[#00B5F1]"
                            />
                        </div>

                        <div>
                            <label className="block text-slate-600 font-bold mb-1">Hotline tiếp đón & Cấp cứu:</label>
                            <input
                                type="text"
                                value={form.dienThoai}
                                onChange={(e) => setForm({ ...form, dienThoai: e.target.value })}
                                placeholder="Chưa cấu hình"
                                className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-[#00B5F1]"
                            />
                        </div>

                        <div>
                            <label className="block text-slate-600 font-bold mb-1">Email liên hệ CSKH:</label>
                            <input
                                type="text"
                                value={form.email}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                                placeholder="Chưa cấu hình"
                                className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-[#00B5F1]"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-slate-600 font-bold mb-1">Địa chỉ trụ sở phòng khám:</label>
                            <input
                                type="text"
                                value={form.diaChi}
                                onChange={(e) => setForm({ ...form, diaChi: e.target.value })}
                                placeholder="Chưa cấu hình"
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
                        <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-semibold">
                            Chưa xác minh kết nối API
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div>
                            <label className="block text-slate-600 font-bold mb-1">URL API Cổng Đơn thuốc Quốc gia:</label>
                            <input
                                type="text"
                                value={form.donThuocQuocGiaUrl}
                                onChange={(e) => setForm({ ...form, donThuocQuocGiaUrl: e.target.value })}
                                placeholder="Chưa cấu hình"
                                className="w-full p-2.5 rounded-lg border border-slate-200 font-mono text-slate-700"
                            />
                        </div>

                        <div>
                            <label className="block text-slate-600 font-bold mb-1">Mã liên thông cơ sở KCB:</label>
                            <input
                                type="text"
                                value={form.maLienThongCoSo}
                                onChange={(e) => setForm({ ...form, maLienThongCoSo: e.target.value })}
                                placeholder="Chưa cấu hình"
                                className="w-full p-2.5 rounded-lg border border-slate-200 font-mono font-bold text-[#00B5F1]"
                            />
                        </div>



                        <div className="md:col-span-2">
                            <label className="block text-slate-600 font-bold mb-1">Giải pháp Chữ ký số Y tế (HSM SmartCA):</label>
                            <input
                                type="text"
                                value={form.chuKySo}
                                onChange={(e) => setForm({ ...form, chuKySo: e.target.value })}
                                placeholder="Chưa cấu hình"
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
                                <label className="block text-slate-600 font-bold mb-1">Mã ngân hàng VietQR (BIN):</label>
                                <input
                                    type="text"
                                    value={form.bankBin}
                                    onChange={(e) => setForm({ ...form, bankBin: e.target.value })}
                                    placeholder="Chưa cấu hình"
                                    className="w-full p-2.5 rounded-lg border border-slate-200 font-mono"
                                />
                            </div>

                            <div>
                                <label className="block text-slate-600 font-bold mb-1">Ngân hàng thụ hưởng VietQR:</label>
                                <input
                                    type="text"
                                    value={form.nganHang}
                                    onChange={(e) => setForm({ ...form, nganHang: e.target.value })}
                                    placeholder="Chưa cấu hình"
                                    className="w-full p-2.5 rounded-lg border border-slate-200"
                                />
                            </div>

                            <div>
                                <label className="block text-slate-600 font-bold mb-1">Số tài khoản thanh toán viện phí:</label>
                                <input
                                    type="text"
                                    value={form.soTaiKhoan}
                                    onChange={(e) => setForm({ ...form, soTaiKhoan: e.target.value })}
                                    placeholder="Chưa cấu hình"
                                    className="w-full p-2.5 rounded-lg border border-slate-200 font-mono font-bold text-[#00B5F1]"
                                />
                            </div>

                            <div>
                                <label className="block text-slate-600 font-bold mb-1">Tên chủ tài khoản:</label>
                                <input
                                    type="text"
                                    value={form.chuTaiKhoan}
                                    onChange={(e) => setForm({ ...form, chuTaiKhoan: e.target.value })}
                                    placeholder="Chưa cấu hình"
                                    className="w-full p-2.5 rounded-lg border border-slate-200 font-bold text-[#003553]"
                                />
                            </div>

                            <div>
                                <label className="block text-slate-600 font-bold mb-1">Cấu hình HĐĐT MISA meInvoice:</label>
                                <input
                                    type="text"
                                    value={form.hoaDonDienTu}
                                    onChange={(e) => setForm({ ...form, hoaDonDienTu: e.target.value })}
                                    placeholder="Chưa cấu hình"
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
                            <div className="text-[11px] font-bold text-slate-700">{form.chuTaiKhoan || 'Chưa cấu hình chủ tài khoản'}</div>
                            <div className="text-[10.5px] font-mono text-slate-500">
                                STK: {form.soTaiKhoan || 'Chưa cấu hình'} &bull; {form.nganHang || 'Chưa cấu hình ngân hàng'}
                            </div>
                            <div className="text-[10.5px] font-mono text-slate-500">BIN: {form.bankBin || 'Chưa cấu hình'}</div>
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold">
                                Lưu đủ thông tin để tạo mã thanh toán
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
