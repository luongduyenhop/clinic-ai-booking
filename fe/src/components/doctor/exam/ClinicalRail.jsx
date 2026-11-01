import { useState } from 'react'
import { Drawer } from 'antd'
import { ORDER_STATUS, RESULT_CLASS } from '../../../utils/constants/clinical'
import { formatDate } from '../../../utils/helpers/formatDate'
import { ClinicIcon } from '../../common/ClinicIcon'
import { AppToast } from '../../common/AppNotification'
import ResultView from '../clinical/ResultView'
import { SAMPLE_PRESCRIPTION_TEMPLATES } from '../../../utils/constants/clinicalTemplates'

const DEMO_OLD_PRESCRIPTIONS = [
    {
        id: 'hist-01',
        ngay: '2026-09-12',
        bac_si: 'BS. Lê Hoàng Long',
        chan_doan: 'J02.9 - Viêm họng cấp',
        ghi_chu: 'Uống thuốc sau ăn no. Kiêng nước đá, giữ ấm cổ họng.',
        items: [
            {
                ten_thuoc: 'Amoxicillin 500mg',
                hoat_chat: 'Amoxicillin',
                ham_luong: '500mg',
                don_vi_tinh: 'Viên',
                sang: '1',
                trua: '0',
                chieu: '1',
                toi: '0',
                so_ngay_dung: '5',
                cach_dung: 'Uống ngay sau ăn no',
            },
            {
                ten_thuoc: 'Paracetamol 500mg',
                hoat_chat: 'Paracetamol',
                ham_luong: '500mg',
                don_vi_tinh: 'Viên',
                sang: '1',
                trua: '1',
                chieu: '1',
                toi: '0',
                so_ngay_dung: '3',
                cach_dung: 'Uống khi sốt >= 38.5°C hoặc đau họng',
            },
            {
                ten_thuoc: 'Alpha Chymotrypsin 4.2mg',
                hoat_chat: 'Chymotrypsin',
                ham_luong: '4.2mg',
                don_vi_tinh: 'Viên',
                sang: '2',
                trua: '0',
                chieu: '2',
                toi: '0',
                so_ngay_dung: '5',
                cach_dung: 'Ngậm dưới lưỡi hoặc uống sau ăn',
            },
        ],
    },
    {
        id: 'hist-02',
        ngay: '2026-06-05',
        bac_si: 'BS. CKII Nguyễn Minh Hoàng',
        chan_doan: 'K21.0 - Trào ngược dạ dày thực quản (GERD)',
        ghi_chu: 'Ăn uống đúng giờ, tránh đồ chua cay, không nằm ngay sau ăn.',
        items: [
            {
                ten_thuoc: 'Esomeprazole 40mg (Nexium)',
                hoat_chat: 'Esomeprazole',
                ham_luong: '40mg',
                don_vi_tinh: 'Viên',
                sang: '1',
                trua: '0',
                chieu: '0',
                toi: '0',
                so_ngay_dung: '14',
                cach_dung: 'Uống trước bữa ăn sáng 30 phút',
            },
            {
                ten_thuoc: 'Gaviscon Dual Action',
                hoat_chat: 'Sodium alginate + Antacids',
                ham_luong: '10ml',
                don_vi_tinh: 'Gói',
                sang: '0',
                trua: '1',
                chieu: '0',
                toi: '1',
                so_ngay_dung: '10',
                cach_dung: 'Uống sau bữa ăn và trước khi đi ngủ',
            },
        ],
    },
]

export default function ClinicalRail({ encounter, onApplyPrescription, onOpenOrderSection, locked }) {
    const [activeTab, setActiveTab] = useState('cls') // 'cls' | 'history' | 'templates'
    const [viewingOrder, setViewingOrder] = useState(null)
    const [searchTerm, setSearchTerm] = useState('')

    const orders = (encounter?.danh_sach_chi_dinh || []).filter((o) => o.trang_thai !== 'da_huy')
    const doneOrders = orders.filter((o) => o.trang_thai === 'da_co_ket_qua')
    const hasUnreadResults = doneOrders.length > 0

    // Kết hợp lịch sử từ encounter và demo
    const rawHistory = encounter?.lich_su || []
    const displayHistory = rawHistory.length > 0 ? rawHistory : DEMO_OLD_PRESCRIPTIONS

    const handleApplyOld = (h) => {
        if (locked) return
        if (!h.items || h.items.length === 0) {
            AppToast.info('Lần khám này không có thông tin chi tiết danh sách thuốc.')
            return
        }
        onApplyPrescription(h.items, h.ghi_chu || h.chan_doan)
        AppToast.success(`Đã sao chép ${h.items.length} thuốc từ lần khám ngày ${formatDate(h.ngay)} vào đơn hiện tại!`)
    }

    const handleApplyTemplate = (tmpl) => {
        if (locked) return
        onApplyPrescription(tmpl.items, tmpl.notes)
        AppToast.warning(`Đã nạp ${tmpl.items.length} thuốc từ phác đồ mẫu "${tmpl.name}". Bác sĩ vui lòng rà soát lại trước khi lưu!`)
    }

    const filteredTemplates = SAMPLE_PRESCRIPTION_TEMPLATES.filter(
        (t) =>
            t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.category.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <aside
            aria-label="Trợ lý lâm sàng và kết quả cận lâm sàng"
            className="flex flex-col gap-3 w-full lg:w-[330px] lg:shrink-0 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden h-fit"
        >
            {/* Header Tabs Navigation */}
            <div className="flex border-b border-slate-200 bg-slate-50/70 p-1 gap-1">
                <button
                    type="button"
                    onClick={() => setActiveTab('cls')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-1 text-xs font-bold rounded-xl transition cursor-pointer ${
                        activeTab === 'cls'
                            ? 'bg-white text-[#003553] shadow-xs ring-1 ring-slate-200'
                            : 'text-slate-600 hover:text-[#003553]'
                    }`}
                >
                    <ClinicIcon name="Microscope" size={15} className={hasUnreadResults ? 'text-emerald-600' : 'text-slate-500'} />
                    <span>CLS ({doneOrders.length}/{orders.length})</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('history')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-1 text-xs font-bold rounded-xl transition cursor-pointer ${
                        activeTab === 'history'
                            ? 'bg-white text-[#003553] shadow-xs ring-1 ring-slate-200'
                            : 'text-slate-600 hover:text-[#003553]'
                    }`}
                >
                    <ClinicIcon name="ClockCounterClockwise" size={15} className="text-slate-500" />
                    <span>Đơn cũ ({displayHistory.length})</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('templates')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-1 text-xs font-bold rounded-xl transition cursor-pointer ${
                        activeTab === 'templates'
                            ? 'bg-white text-[#003553] shadow-xs ring-1 ring-slate-200'
                            : 'text-slate-600 hover:text-[#003553]'
                    }`}
                >
                    <ClinicIcon name="BookmarkSimple" size={15} className="text-amber-600" />
                    <span>Toa mẫu (7)</span>
                </button>
            </div>

            {/* TAB 1: KẾT QUẢ CẬN LÂM SÀNG */}
            {activeTab === 'cls' && (
                <div className="p-3.5 flex flex-col gap-3 max-h-[75vh] overflow-y-auto">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#003553] uppercase tracking-wider">
                            Chỉ định Cận Lâm Sàng
                        </span>
                        {!locked && onOpenOrderSection && (
                            <button
                                type="button"
                                onClick={onOpenOrderSection}
                                className="text-xs font-semibold text-[#00A9E3] hover:underline cursor-pointer"
                            >
                                + Chỉ định mới
                            </button>
                        )}
                    </div>

                    {orders.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
                            <ClinicIcon name="Microscope" size={28} className="text-slate-300" />
                            <span>Chưa có chỉ định cận lâm sàng nào trong ca khám này.</span>
                            {!locked && onOpenOrderSection && (
                                <button
                                    type="button"
                                    onClick={onOpenOrderSection}
                                    className="mt-1 px-3 py-1.5 rounded-lg bg-[#E8F4FD] text-[#003553] font-semibold text-xs hover:bg-[#d4ecfc] transition"
                                >
                                    Thêm chỉ định xét nghiệm/CĐHA
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {orders.map((o) => {
                                const st = ORDER_STATUS[o.trang_thai] || { label: o.trang_thai, badge: 'medpro-badge' }
                                const cls = RESULT_CLASS[o.ket_qua_phan_loai]
                                const hasResult = o.trang_thai === 'da_co_ket_qua'

                                return (
                                    <div
                                        key={o.id}
                                        className={`flex flex-col gap-1.5 rounded-xl border p-3 transition ${
                                            hasResult
                                                ? 'border-emerald-200 bg-emerald-50/40'
                                                : 'border-slate-200 bg-slate-50/60'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <span className="text-[13px] font-bold text-[#003553] leading-snug">
                                                {o.ten_dich_vu}
                                            </span>
                                            <span className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full font-bold ${
                                                hasResult ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800 animate-pulse'
                                            }`}>
                                                {st.label}
                                            </span>
                                        </div>

                                        {hasResult ? (
                                            <div className="flex items-center justify-between pt-1 border-t border-emerald-100/80">
                                                <span className={`text-[12px] font-semibold ${
                                                    o.ket_qua_phan_loai && o.ket_qua_phan_loai !== 'BINH_THUONG' ? 'text-rose-700' : 'text-emerald-700'
                                                }`}>
                                                    {cls?.label || 'Đã có kết quả'}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => setViewingOrder(o)}
                                                    className="inline-flex items-center gap-1 text-xs font-bold text-[#0077B6] hover:underline cursor-pointer"
                                                >
                                                    <ClinicIcon name="Eye" size={13} />
                                                    Xem kết quả
                                                </button>
                                            </div>
                                        ) : (
                                            <span className="text-[11px] text-slate-500 italic">
                                                Đang chờ phòng CLS thực hiện & trả kết quả...
                                            </span>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 2: LỊCH SỬ KHÁM CŨ & SAO CHÉP ĐƠN THUỐC */}
            {activeTab === 'history' && (
                <div className="p-3.5 flex flex-col gap-3 max-h-[75vh] overflow-y-auto">
                    <span className="text-xs font-bold text-[#003553] uppercase tracking-wider">
                        Lịch Sử Các Lần Khám Trước
                    </span>

                    <div className="flex flex-col gap-3">
                        {displayHistory.map((h, idx) => (
                            <div
                                key={h.id || idx}
                                className="rounded-xl border border-slate-200 bg-white p-3.5 flex flex-col gap-2 hover:border-[#8DDBF7] transition"
                            >
                                <div className="flex items-center justify-between text-xs text-slate-500 border-b border-slate-100 pb-1.5">
                                    <span className="font-semibold text-slate-700">📅 {formatDate(h.ngay)}</span>
                                    <span>{h.bac_si}</span>
                                </div>

                                <div>
                                    <span className="text-[11px] font-bold text-slate-400 uppercase">Chẩn đoán:</span>
                                    <p className="text-[13px] font-bold text-[#003553] leading-snug">{h.chan_doan}</p>
                                </div>

                                {h.items && h.items.length > 0 && (
                                    <div className="mt-1 flex flex-col gap-1 bg-[#F5F9FC] rounded-lg p-2 text-xs">
                                        <span className="text-[11px] font-bold text-slate-500">
                                            Đơn thuốc ({h.items.length} loại):
                                        </span>
                                        <ul className="list-disc list-inside space-y-0.5 text-slate-700">
                                            {h.items.slice(0, 3).map((item, i) => (
                                                <li key={i} className="truncate">
                                                    {item.ten_thuoc} {item.ham_luong ? `(${item.ham_luong})` : ''}
                                                </li>
                                            ))}
                                            {h.items.length > 3 && (
                                                <li className="text-slate-400 italic">và {h.items.length - 3} thuốc khác...</li>
                                            )}
                                        </ul>
                                    </div>
                                )}

                                {!locked && h.items && h.items.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => handleApplyOld(h)}
                                        className="mt-1 w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-[#E8F4FD] text-[#003553] text-xs font-bold hover:bg-[#d1eafc] transition cursor-pointer"
                                    >
                                        <ClinicIcon name="Copy" size={14} />
                                        <span>Sao chép đơn này vào ca khám</span>
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB 3: TOA THUỐC MẪU LÂM SÀNG (7 MẶT BỆNH PHỔ BIẾN - Ý TƯỞNG SIMPLECLINIC) */}
            {activeTab === 'templates' && (
                <div className="p-3.5 flex flex-col gap-3 max-h-[75vh] overflow-y-auto">
                    <div className="flex flex-col gap-1.5">
                        <span className="text-xs font-bold text-[#003553] uppercase tracking-wider">
                            Phác Đồ Đơn Thuốc Mẫu
                        </span>
                        <input
                            type="search"
                            className="w-full text-xs rounded-xl border border-slate-200 px-3 py-1.5 outline-none focus:border-[#00B5F1]"
                            placeholder="Tìm theo bệnh: dạ dày, viêm họng, sốt..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex flex-col gap-2.5">
                        {filteredTemplates.map((tmpl) => (
                            <div
                                key={tmpl.id}
                                className="rounded-xl border border-slate-200 bg-white p-3 flex flex-col gap-2 hover:border-[#00B5F1] transition"
                            >
                                <div className="flex items-start justify-between gap-1">
                                    <span className="text-[13px] font-bold text-[#003553] leading-snug">
                                        {tmpl.name}
                                    </span>
                                    <span className="shrink-0 text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded">
                                        {tmpl.category}
                                    </span>
                                </div>

                                <div className="bg-[#F5F9FC] rounded-lg p-2 text-xs">
                                    <span className="text-[11px] font-bold text-slate-500">
                                        Gồm {tmpl.items.length} thuốc phác đồ:
                                    </span>
                                    <ul className="mt-1 list-disc list-inside text-slate-700 space-y-0.5">
                                        {tmpl.items.slice(0, 3).map((it, i) => (
                                            <li key={i} className="truncate">
                                                {it.ten_thuoc}
                                            </li>
                                        ))}
                                        {tmpl.items.length > 3 && (
                                            <li className="text-slate-400 italic">và {tmpl.items.length - 3} thuốc khác...</li>
                                        )}
                                    </ul>
                                </div>

                                {!locked && (
                                    <button
                                        type="button"
                                        onClick={() => handleApplyTemplate(tmpl)}
                                        className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-teal-50 text-teal-800 border border-teal-200 text-xs font-bold hover:bg-teal-100 transition cursor-pointer"
                                    >
                                        <ClinicIcon name="BookmarkSimple" size={14} />
                                        <span>Nạp phác đồ này vào đơn nháp</span>
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Modal xem chi tiết kết quả CLS */}
            <Drawer
                title={`Kết quả: ${viewingOrder?.ten_dich_vu}`}
                open={Boolean(viewingOrder)}
                onClose={() => setViewingOrder(null)}
                width={560}
            >
                {viewingOrder && <ResultView order={viewingOrder} />}
            </Drawer>
        </aside>
    )
}
