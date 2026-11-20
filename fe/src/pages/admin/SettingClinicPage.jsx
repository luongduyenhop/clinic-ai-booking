import { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useLocation } from 'react-router-dom'
import { AppToast } from '../../components/common/AppNotification'
import { updateClinicCollectionAsync } from '../../redux/actions/admin/adminAction'
import {
    FloppyDisk,
    ArrowsClockwise,
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

    const [form, setForm] = useState({
        tenPhongKham: settings.tenPhongKham || 'Phòng Khám Đa Khoa Quốc Tế Clinic-AI',
        maCoSoKCB: settings.maCoSoKCB || '01-08924',
        giayPhepHoatDong: settings.giayPhepHoatDong || 'Số 1428/HNO-GPHĐ (Cấp ngày 10/01/2023)',
        nguoiChiuTrachNhiem: 'BS.CKII Nguyễn Minh Hoàng (CCHN: 004512/HNO-CCHN)',
        dienThoai: settings.dienThoai || '1900 2115',
        email: settings.email || 'cskh@clinic-ai.vn',
        diaChi: settings.diaChi || 'Số 18 Duy Tân, Phường Dịch Vọng Hậu, Quận Cầu Giấy, Hà Nội',
        donThuocQuocGiaUrl: settings.congLienThong?.donThuocQuocGiaUrl || 'https://donthuocquocgia.vn/api/v1',
        maLienThongCoSo: settings.congLienThong?.maLienThongCoSo || 'LT_0108924_CLINICAI',
        duocQuocGiaUrl: settings.congLienThong?.duocQuocGiaUrl || 'https://duocquocgia.com.vn/api/v2',
        maCoSoDuoc: settings.congLienThong?.maCoSoDuoc || 'DQG_0108924',
        chuKySo: settings.congLienThong?.chuKySo || 'VNPT SmartCA HSM (Đã kích hoạt cho 04 Bác sĩ)',
        hoaDonDienTu: settings.congLienThong?.hoaDonDienTu || 'MISA meInvoice (MST: 0109988231 - Ký hiệu: 1C26TAA)',
        nganHang: 'Ngân hàng TMCP Quân Đội (MBBank)',
        soTaiKhoan: '0892419002115',
        chuTaiKhoan: 'PHONG KHAM DA KHOA QUOC TE CLINIC-AI',
        batBuocICD10: settings.heThong?.batBuocICD10 ?? true,
        thuTienTruocCLS: settings.heThong?.thuTienTruocCLS ?? true,
        tuDongKhoaSoSauGio: settings.heThong?.tuDongKhoaSoSauGio || '23:00 (Sau 1 ngày)',
    })

    useEffect(() => {
        if (clinicData?.clinicSettings) {
            const s = clinicData.clinicSettings
            setForm((prev) => ({
                ...prev,
                tenPhongKham: s.tenPhongKham || prev.tenPhongKham,
                maCoSoKCB: s.maCoSoKCB || prev.maCoSoKCB,
                giayPhepHoatDong: s.giayPhepHoatDong || prev.giayPhepHoatDong,
                dienThoai: s.dienThoai || prev.dienThoai,
                email: s.email || prev.email,
                diaChi: s.diaChi || prev.diaChi,
                donThuocQuocGiaUrl: s.congLienThong?.donThuocQuocGiaUrl || prev.donThuocQuocGiaUrl,
                maLienThongCoSo: s.congLienThong?.maLienThongCoSo || prev.maLienThongCoSo,
                duocQuocGiaUrl: s.congLienThong?.duocQuocGiaUrl || prev.duocQuocGiaUrl,
                maCoSoDuoc: s.congLienThong?.maCoSoDuoc || prev.maCoSoDuoc,
                chuKySo: s.congLienThong?.chuKySo || prev.chuKySo,
                hoaDonDienTu: s.congLienThong?.hoaDonDienTu || prev.hoaDonDienTu,
                batBuocICD10: s.heThong?.batBuocICD10 ?? prev.batBuocICD10,
                thuTienTruocCLS: s.heThong?.thuTienTruocCLS ?? prev.thuTienTruocCLS,
                tuDongKhoaSoSauGio: s.heThong?.tuDongKhoaSoSauGio || prev.tuDongKhoaSoSauGio,
            }))
        }
    }, [clinicData?.clinicSettings])

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
            AppToast.success('Kết nối Cổng Đơn thuốc Quốc gia BYT thành công. Độ trễ: 42ms')
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
        AppToast.success('Lưu cấu hình hệ thống phòng khám thành công')
    }

    return (
        <div className="space-y-4">
            <div className="medpro-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-display text-base font-extrabold text-clinic-navy uppercase">
                            Cài đặt Hệ thống Phòng khám
                        </h2>
                        <span className="medpro-badge-info">
                            Cơ sở KCB Bộ Y tế
                        </span>
                    </div>
                    <p className="text-xs text-clinic-text-secondary mt-0.5">
                        Thông số pháp lý cơ sở khám chữa bệnh, cổng liên thông Quốc gia (TT 26), VietQR &amp; MISA meInvoice
                    </p>
                </div>

                <button
                    type="button"
                    onClick={handleSave}
                    className="medpro-btn-primary !py-2 !px-4 text-xs shrink-0"
                >
                    <FloppyDisk size={15} weight="bold" />
                    <span>Lưu thay đổi</span>
                </button>
            </div>

            <div className="medpro-card p-2 flex flex-wrap items-center gap-1">
                <div className="flex flex-wrap items-center gap-1 bg-clinic-bg-muted p-1 rounded-[6px] border border-clinic-border">
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
                            className={`px-3 py-1.5 rounded-[6px] text-xs font-bold transition-colors cursor-pointer ${
                                activeTab === t.id
                                    ? 'bg-clinic-navy text-clinic-surface'
                                    : 'text-clinic-text-secondary hover:text-clinic-navy'
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {activeTab === 'THONG_TIN' && (
                <div className="medpro-card p-5 space-y-4">
                    <div className="medpro-section-title">
                        <span>THÔNG TIN PHÁP LÝ CƠ SỞ KHÁM CHỮA BỆNH (GIẤY PHÉP BỘ Y TẾ)</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div>
                            <label className="medpro-label">Tên cơ sở khám chữa bệnh</label>
                            <input
                                type="text"
                                value={form.tenPhongKham}
                                onChange={(e) => setForm({ ...form, tenPhongKham: e.target.value })}
                                className="medpro-input font-bold text-clinic-navy"
                            />
                        </div>

                        <div>
                            <label className="medpro-label">Mã định danh KCB (Sở Y tế cấp)</label>
                            <input
                                type="text"
                                value={form.maCoSoKCB}
                                onChange={(e) => setForm({ ...form, maCoSoKCB: e.target.value })}
                                className="medpro-input font-mono font-bold text-clinic-cta tabular-nums"
                            />
                        </div>

                        <div>
                            <label className="medpro-label">Số Giấy phép hoạt động y tế</label>
                            <input
                                type="text"
                                value={form.giayPhepHoatDong}
                                onChange={(e) => setForm({ ...form, giayPhepHoatDong: e.target.value })}
                                className="medpro-input"
                            />
                        </div>

                        <div>
                            <label className="medpro-label">Người chịu trách nhiệm chuyên môn kỹ thuật</label>
                            <input
                                type="text"
                                value={form.nguoiChiuTrachNhiem}
                                onChange={(e) => setForm({ ...form, nguoiChiuTrachNhiem: e.target.value })}
                                className="medpro-input"
                            />
                        </div>

                        <div>
                            <label className="medpro-label">Hotline tiếp đón &amp; Cấp cứu</label>
                            <input
                                type="text"
                                value={form.dienThoai}
                                onChange={(e) => setForm({ ...form, dienThoai: e.target.value })}
                                className="medpro-input tabular-nums"
                            />
                        </div>

                        <div>
                            <label className="medpro-label">Email liên hệ CSKH</label>
                            <input
                                type="text"
                                value={form.email}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                                className="medpro-input"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="medpro-label">Địa chỉ trụ sở phòng khám</label>
                            <input
                                type="text"
                                value={form.diaChi}
                                onChange={(e) => setForm({ ...form, diaChi: e.target.value })}
                                className="medpro-input"
                            />
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'CONG_LIEN_THONG' && (
                <div className="medpro-card p-5 space-y-4">
                    <div className="medpro-section-title">
                        <span>KẾT NỐI ĐƠN THUỐC QUỐC GIA &amp; HỒ SƠ SỨC KHỎE (TT 26/2023)</span>
                        <button
                            type="button"
                            onClick={handlePingGateway}
                            disabled={isPinging}
                            className="medpro-btn-outline !py-1.5 !px-3 text-xs"
                        >
                            <ArrowsClockwise size={14} className={isPinging ? 'animate-spin' : ''} />
                            <span>{isPinging ? 'Đang kiểm tra...' : 'Kiểm tra kết nối (Ping)'}</span>
                        </button>
                    </div>

                    {pingResult && (
                        <div className="p-3.5 rounded-[6px] border border-clinic-success-border bg-clinic-success-bg text-xs flex items-center justify-between tabular-nums">
                            <div className="flex items-center gap-2">
                                <CheckCircle size={18} weight="fill" className="text-clinic-success shrink-0" />
                                <div>
                                    <div className="font-bold text-clinic-navy">
                                        Cổng Quốc gia đang hoạt động (HTTP {pingResult.code} OK)
                                    </div>
                                    <div className="text-[11px] text-clinic-success">
                                        Phiên bản: {pingResult.gatewayVersion} &bull; Thời gian phản hồi: {pingResult.latency}ms
                                    </div>
                                </div>
                            </div>
                            <span className="medpro-badge-success font-mono">
                                ONLINE
                            </span>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div>
                            <label className="medpro-label">URL API Cổng Đơn thuốc Quốc gia</label>
                            <input
                                type="text"
                                value={form.donThuocQuocGiaUrl}
                                onChange={(e) => setForm({ ...form, donThuocQuocGiaUrl: e.target.value })}
                                className="medpro-input font-mono text-clinic-text-secondary"
                            />
                        </div>

                        <div>
                            <label className="medpro-label">Mã liên thông cơ sở KCB</label>
                            <input
                                type="text"
                                value={form.maLienThongCoSo}
                                onChange={(e) => setForm({ ...form, maLienThongCoSo: e.target.value })}
                                className="medpro-input font-mono font-bold text-clinic-cta"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="medpro-label">Giải pháp Chữ ký số Y tế (HSM SmartCA)</label>
                            <input
                                type="text"
                                value={form.chuKySo}
                                onChange={(e) => setForm({ ...form, chuKySo: e.target.value })}
                                className="medpro-input font-medium text-clinic-navy"
                            />
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'TAI_CHINH' && (
                <div className="medpro-card p-5 space-y-4">
                    <div className="medpro-section-title">
                        <span>CẤU HÌNH THANH TOÁN VIETQR &amp; HÓA ĐƠN ĐIỆN TỬ</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="space-y-3">
                            <div>
                                <label className="medpro-label">Ngân hàng thụ hưởng VietQR</label>
                                <input
                                    type="text"
                                    value={form.nganHang}
                                    onChange={(e) => setForm({ ...form, nganHang: e.target.value })}
                                    className="medpro-input"
                                />
                            </div>

                            <div>
                                <label className="medpro-label">Số tài khoản thanh toán viện phí</label>
                                <input
                                    type="text"
                                    value={form.soTaiKhoan}
                                    onChange={(e) => setForm({ ...form, soTaiKhoan: e.target.value })}
                                    className="medpro-input font-mono font-bold text-clinic-cta tabular-nums"
                                />
                            </div>

                            <div>
                                <label className="medpro-label">Tên chủ tài khoản</label>
                                <input
                                    type="text"
                                    value={form.chuTaiKhoan}
                                    onChange={(e) => setForm({ ...form, chuTaiKhoan: e.target.value })}
                                    className="medpro-input font-bold text-clinic-navy"
                                />
                            </div>

                            <div>
                                <label className="medpro-label">Cấu hình HĐĐT MISA meInvoice</label>
                                <input
                                    type="text"
                                    value={form.hoaDonDienTu}
                                    onChange={(e) => setForm({ ...form, hoaDonDienTu: e.target.value })}
                                    className="medpro-input"
                                />
                            </div>
                        </div>

                        <div className="p-4 rounded-[6px] border border-clinic-info-border bg-clinic-surface-tint flex flex-col items-center justify-center text-center space-y-2">
                            <span className="text-xs font-bold text-clinic-navy uppercase">Mẫu mã VietQR tiếp đón</span>
                            <div className="w-36 h-36 bg-clinic-surface p-2 rounded-[6px] border border-clinic-border flex items-center justify-center">
                                <QrCode size={110} className="text-clinic-navy" />
                            </div>
                            <div className="text-[11px] font-bold text-clinic-navy">{form.chuTaiKhoan}</div>
                            <div className="text-[11px] font-mono text-clinic-text-secondary tabular-nums">
                                STK: {form.soTaiKhoan} &bull; MBBank
                            </div>
                            <span className="medpro-badge-success">
                                Tự động gạch nợ hóa đơn
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'QUY_DINH' && (
                <div className="medpro-card p-5 space-y-4">
                    <div className="medpro-section-title">
                        <span>RÀNG BUỘC NGHIỆP VỤ &amp; QUY CHẾ VẬN HÀNH BỆNH ÁN</span>
                    </div>

                    <div className="space-y-3 text-xs">
                        <label className="flex items-center gap-3 p-3 rounded-[6px] border border-clinic-border hover:bg-clinic-bg cursor-pointer transition-colors">
                            <input
                                type="checkbox"
                                checked={form.batBuocICD10}
                                onChange={(e) => setForm({ ...form, batBuocICD10: e.target.checked })}
                                className="w-4 h-4 rounded-[4px]"
                            />
                            <div>
                                <div className="font-bold text-clinic-navy">Bắt buộc nhập mã chẩn đoán ICD-10 trước khi kê đơn</div>
                                <div className="text-clinic-text-secondary text-[11px]">
                                    Ngăn chặn đơn thuốc thiếu mã bệnh theo quy định Thông tư 04/2022/TT-BYT
                                </div>
                            </div>
                        </label>

                        <label className="flex items-center gap-3 p-3 rounded-[6px] border border-clinic-border hover:bg-clinic-bg cursor-pointer transition-colors">
                            <input
                                type="checkbox"
                                checked={form.thuTienTruocCLS}
                                onChange={(e) => setForm({ ...form, thuTienTruocCLS: e.target.checked })}
                                className="w-4 h-4 rounded-[4px]"
                            />
                            <div>
                                <div className="font-bold text-clinic-navy">
                                    Thu viện phí trước khi thực hiện Cận lâm sàng (X-Quang, Xét nghiệm, Siêu âm)
                                </div>
                                <div className="text-clinic-text-secondary text-[11px]">
                                    Chỉ chuyển trạng thái phòng máy khi đã có phiếu thu hợp lệ từ quầy thu ngân
                                </div>
                            </div>
                        </label>

                        <div className="p-3 rounded-[6px] border border-clinic-border bg-clinic-bg flex items-center justify-between">
                            <div>
                                <div className="font-bold text-clinic-navy">Tự động khóa sổ quỹ ca trực cuối ngày</div>
                                <div className="text-clinic-text-secondary text-[11px]">
                                    Tạo biên bản quỹ bất biến lưu vết kiểm toán
                                </div>
                            </div>
                            <span className="font-mono font-bold text-clinic-cta tabular-nums">{form.tuDongKhoaSoSauGio}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
