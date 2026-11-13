import { Printer, XCircle, CheckCircle, Receipt } from './ClinicIcon'

export default function ReceiptModal({
    isOpen,
    onClose,
    voucher = {},
    clinicInfo = {},
}) {
    if (!isOpen) return null

    const clinicDetails = clinicInfo.is_synthetic === true || String(clinicInfo.data_classification || '').startsWith('SYNTHETIC')
        ? {}
        : clinicInfo
    const clinicName = clinicDetails.tenPhongKham || 'Chưa cấu hình tên cơ sở'
    const clinicAddress = clinicDetails.diaChi || 'Chưa cấu hình địa chỉ'
    const clinicPhone = clinicDetails.dienThoai || 'Chưa cấu hình'
    const clinicCode = clinicDetails.maCoSoKCB || 'Chưa cấu hình'

    const voucherCode = voucher.maPhieu || voucher.id || 'Chưa ghi nhận'
    const receiptDate = voucher.ngayThu || voucher.ngayLap || 'Chưa ghi nhận'
    const patientName = voucher.hoTenBN || voucher.ten_benh_nhan || voucher.benh_nhan?.ho_ten || 'Chưa ghi nhận'
    const patientCode = voucher.maBN || voucher.ma_benh_nhan || voucher.benh_nhan?.mabn || 'Chưa ghi nhận'
    const encounterCode = voucher.maKCB || voucher.luot_kham_id || 'Chưa ghi nhận'
    const cashierName = voucher.nguoiThu || 'Chưa ghi nhận'
    const paymentMethod = voucher.hinhThuc || voucher.phuong_thuc_thanh_toan || 'Chưa ghi nhận'

    const lineItems = Array.isArray(voucher.items) && voucher.items.length > 0
        ? voucher.items
        : Array.isArray(voucher.chi_tiet_hoa_don) && voucher.chi_tiet_hoa_don.length > 0
        ? voucher.chi_tiet_hoa_don.map((it, idx) => ({
            id: it.id || idx,
            tenKhoan: it.ten_khoan_thu,
            soTien: it.thanh_tien == null || it.thanh_tien === '' ? undefined : Number(it.thanh_tien),
            soLuong: it.so_luong,
            donGia: it.don_gia == null || it.don_gia === '' ? undefined : Number(it.don_gia),
            ghiChu: it.ghi_chu,
        }))
        : []

    const rawTotalAmount = voucher.tongTien ?? voucher.tong_tien
    const totalAmount = rawTotalAmount == null || rawTotalAmount === '' ? null : Number(rawTotalAmount)
    const rawDiscountAmount = voucher.mienGiam ?? voucher.mien_giam
    const discountAmount = rawDiscountAmount == null || rawDiscountAmount === '' ? null : Number(rawDiscountAmount)
    const rawFinalAmount = voucher.thucThu ?? voucher.thuc_thu
    const finalAmount = rawFinalAmount != null && rawFinalAmount !== ''
        ? Number(rawFinalAmount)
        : totalAmount !== null && discountAmount !== null
        ? Math.max(0, totalAmount - discountAmount)
        : null

    const isPaid = voucher.daThu === true || voucher.trang_thai === 'da_thu'
    const isUnpaid = voucher.daThu === false

    const handlePrint = () => {
        window.print()
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
            <style>{`
                @media print {
                    body * {
                        visibility: hidden !important;
                    }
                    #receipt-print-area, #receipt-print-area * {
                        visibility: visible !important;
                    }
                    #receipt-print-area {
                        position: fixed !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 32px !important;
                        background: #ffffff !important;
                        border: none !important;
                        box-shadow: none !important;
                        z-index: 999999 !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                }
            `}</style>

            <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col my-8">
                <div className="bg-[#003553] p-4 text-white flex items-center justify-between no-print">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center text-teal-300">
                            <Receipt size={22} weight="bold" />
                        </div>
                        <div>
                            <h3 className="text-sm font-extrabold uppercase tracking-wide">Xem trước & In Biên lai Viện phí</h3>
                            <p className="text-xs text-sky-100">Mẫu chứng từ tài chính chuẩn hóa cho phòng khám ngoại trú</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition cursor-pointer"
                    >
                        <XCircle size={20} weight="bold" />
                    </button>
                </div>

                <div id="receipt-print-area" className="p-8 text-slate-800 bg-white">
                    <div className="flex items-start justify-between border-b border-slate-200 pb-4 mb-5">
                        <div className="space-y-1">
                            <h2 className="text-base font-black tracking-tight text-[#003553] uppercase">{clinicName}</h2>
                            <p className="text-xs text-slate-600">{clinicAddress}</p>
                            <p className="text-xs text-slate-600">Hotline: <span className="font-bold">{clinicPhone}</span> | Mã cơ sở KCB: <span className="font-bold">{clinicCode}</span></p>
                        </div>
                        <div className="text-right space-y-1">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">Mã chứng từ</span>
                            <span className="font-mono text-sm font-black text-rose-600">{voucherCode}</span>
                            <span className="text-[11px] text-slate-500 block">{receiptDate}</span>
                        </div>
                    </div>

                    <div className="text-center my-4">
                        <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase">BIÊN LAI THU VIỆN PHÍ</h1>
                        <p className="text-xs text-slate-500 italic mt-0.5">(Liên dành cho người bệnh & lưu trữ nội bộ phòng khám)</p>
                    </div>

                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 grid grid-cols-2 gap-3 text-xs mb-5">
                        <div>
                            <span className="text-slate-500 block">Họ và tên người bệnh:</span>
                            <span className="font-bold text-slate-900 text-sm">{patientName}</span>
                        </div>
                        <div>
                            <span className="text-slate-500 block">Mã định danh y tế (Mã BN):</span>
                            <span className="font-mono font-bold text-slate-900">{patientCode}</span>
                        </div>
                        <div>
                            <span className="text-slate-500 block">Mã lượt khám (KCB):</span>
                            <span className="font-mono font-bold text-sky-900">{encounterCode}</span>
                        </div>
                        <div>
                            <span className="text-slate-500 block">Hình thức thu:</span>
                            <span className="font-bold text-slate-800">{paymentMethod}</span>
                        </div>
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-hidden mb-5">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead className="bg-[#003553] text-white">
                                <tr>
                                    <th className="py-2.5 px-3 font-bold w-12 text-center">STT</th>
                                    <th className="py-2.5 px-3 font-bold">Nội dung khoản thu viện phí</th>
                                    <th className="py-2.5 px-3 font-bold w-16 text-center">SL</th>
                                    <th className="py-2.5 px-3 font-bold w-24 text-right">Đơn giá</th>
                                    <th className="py-2.5 px-3 font-bold w-28 text-right">Thành tiền</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {lineItems.map((item, index) => {
                                    const qty = item.soLuong == null || item.soLuong === '' ? null : Number(item.soLuong)
                                    const unitPrice = item.donGia == null || item.donGia === ''
                                        ? item.soTien != null && qty > 0 ? Number(item.soTien) / qty : null
                                        : Number(item.donGia)
                                    const itemTotal = item.soTien == null || item.soTien === ''
                                        ? qty != null && unitPrice != null ? qty * unitPrice : null
                                        : Number(item.soTien)
                                    return (
                                        <tr key={item.id || index} className="hover:bg-slate-50">
                                            <td className="py-2 px-3 text-center text-slate-500">{index + 1}</td>
                                            <td className="py-2 px-3 font-semibold text-slate-900">
                                                {item.tenKhoan}
                                                {item.ghiChu && <span className="block text-[10px] text-slate-400 font-normal">{item.ghiChu}</span>}
                                            </td>
                                            <td className="py-2 px-3 text-center">{qty ?? 'Chưa ghi nhận'}</td>
                                            <td className="py-2 px-3 text-right font-mono text-slate-600">{unitPrice == null ? 'Chưa ghi nhận' : `${Number(unitPrice).toLocaleString('vi-VN')} đ`}</td>
                                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{itemTotal == null ? 'Chưa ghi nhận' : `${Number(itemTotal).toLocaleString('vi-VN')} đ`}</td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-end mb-6">
                        <div className="w-72 space-y-1.5 text-xs">
                            <div className="flex justify-between text-slate-600">
                                <span>Tổng cộng chi phí:</span>
                                <span className="font-mono font-bold text-slate-800">{totalAmount == null ? 'Chưa ghi nhận' : `${totalAmount.toLocaleString('vi-VN')} đ`}</span>
                            </div>
                            <div className="flex justify-between text-emerald-700">
                                <span>Miễn giảm / Ưu đãi:</span>
                                <span className="font-mono font-bold">{discountAmount == null ? 'Chưa ghi nhận' : `-${discountAmount.toLocaleString('vi-VN')} đ`}</span>
                            </div>
                            <div className="flex justify-between text-sm font-black text-rose-600 border-t border-slate-300 pt-2">
                                <span>SỐ TIỀN THỰC THU:</span>
                                <span className="font-mono text-base">{finalAmount == null ? 'Chưa ghi nhận' : `${finalAmount.toLocaleString('vi-VN')} đ`}</span>
                            </div>
                            <div className="flex items-center justify-end gap-1 text-[11px] mt-1">
                                {isPaid ? (
                                    <span className="inline-flex items-center gap-1 text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                        <CheckCircle size={14} weight="fill" />
                                        ĐÃ THANH TOÁN HOÀN TẤT
                                    </span>
                                ) : isUnpaid ? (
                                    <span className="text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                        CHƯA THU TIỀN
                                    </span>
                                ) : (
                                    <span className="text-slate-500 font-semibold bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                                        {voucher.trang_thai || 'CHƯA GHI NHẬN TRẠNG THÁI THANH TOÁN'}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-8 text-center text-xs pt-4 border-t border-dashed border-slate-200">
                        <div className="space-y-1">
                            <div className="font-bold uppercase text-slate-700">Người nộp tiền</div>
                            <div className="text-[10px] text-slate-400 italic">(Ký và ghi rõ họ tên)</div>
                            <div className="h-16"></div>
                            <div className="font-semibold text-slate-800">{patientName}</div>
                        </div>
                        <div className="space-y-1">
                            <div className="font-bold uppercase text-slate-700">Người thu tiền (Thu ngân)</div>
                            <div className="text-[10px] text-slate-400 italic">(Ký và ghi rõ họ tên)</div>
                            <div className="h-16"></div>
                            <div className="font-semibold text-slate-800">{cashierName}</div>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between no-print">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition cursor-pointer"
                    >
                        Đóng lại
                    </button>
                    <button
                        type="button"
                        onClick={handlePrint}
                        className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-black text-xs flex items-center gap-2 transition cursor-pointer shadow-md"
                    >
                        <Printer size={16} weight="bold" />
                        <span>Kích hoạt lệnh in</span>
                    </button>
                </div>
            </div>
        </div>
    )
}
