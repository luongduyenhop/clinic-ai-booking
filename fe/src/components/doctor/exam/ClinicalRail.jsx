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
    const [activeTab, setActiveTab] = useState('cls')
    const [viewingOrder, setViewingOrder] = useState(null)
    const [searchTerm, setSearchTerm] = useState('')

    const orders = (encounter?.danh_sach_chi_dinh || []).filter((o) => o.trang_thai !== 'da_huy')
    const doneOrders = orders.filter((o) => o.trang_thai === 'da_co_ket_qua')
    const hasUnreadResults = doneOrders.length > 0

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
            className="medpro-card flex flex-col gap-3 w-full lg:w-[330px] lg:shrink-0 bg-clinic-surface overflow-hidden h-fit"
        >
            <div className="flex border-b border-clinic-border bg-clinic-bg p-1 gap-1">
                <button
                    type="button"
                    onClick={() => setActiveTab('cls')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-1 text-xs font-bold rounded-[6px] transition cursor-pointer tabular-nums ${
                        activeTab === 'cls'
                            ? 'bg-clinic-navy text-clinic-surface'
                            : 'text-clinic-text-secondary hover:text-clinic-navy hover:bg-clinic-surface'
                    }`}
                >
                    <ClinicIcon name="Microscope" size={15} className={activeTab === 'cls' ? 'text-clinic-surface' : hasUnreadResults ? 'text-clinic-success' : 'text-clinic-text-secondary'} />
                    <span>CLS ({doneOrders.length}/{orders.length})</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('history')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-1 text-xs font-bold rounded-[6px] transition cursor-pointer tabular-nums ${
                        activeTab === 'history'
                            ? 'bg-clinic-navy text-clinic-surface'
                            : 'text-clinic-text-secondary hover:text-clinic-navy hover:bg-clinic-surface'
                    }`}
                >
                    <ClinicIcon name="ClockCounterClockwise" size={15} />
                    <span>Đơn cũ ({displayHistory.length})</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('templates')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-1 text-xs font-bold rounded-[6px] transition cursor-pointer tabular-nums ${
                        activeTab === 'templates'
                            ? 'bg-clinic-navy text-clinic-surface'
                            : 'text-clinic-text-secondary hover:text-clinic-navy hover:bg-clinic-surface'
                    }`}
                >
                    <ClinicIcon name="BookmarkSimple" size={15} className={activeTab === 'templates' ? 'text-clinic-surface' : 'text-clinic-warning'} />
                    <span>Toa mẫu (7)</span>
                </button>
            </div>

            {activeTab === 'cls' && (
                <div className="p-3.5 flex flex-col gap-3 max-h-[75vh] overflow-y-auto">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-clinic-navy">
                            Chỉ định cận lâm sàng
                        </span>
                        {!locked && onOpenOrderSection && (
                            <button
                                type="button"
                                onClick={onOpenOrderSection}
                                className="text-xs font-semibold text-clinic-cta hover:underline cursor-pointer"
                            >
                                + Chỉ định mới
                            </button>
                        )}
                    </div>

                    {orders.length === 0 ? (
                        <div className="rounded-[6px] border border-dashed border-clinic-border p-6 text-center text-xs text-clinic-text-secondary flex flex-col items-center gap-2">
                            <ClinicIcon name="Microscope" size={28} className="text-clinic-text-subtle" />
                            <span>Chưa có chỉ định cận lâm sàng nào trong ca khám này.</span>
                            {!locked && onOpenOrderSection && (
                                <button
                                    type="button"
                                    onClick={onOpenOrderSection}
                                    className="medpro-btn-outline mt-1 px-3 py-1.5 text-xs font-semibold"
                                >
                                    Thêm chỉ định xét nghiệm/CĐHA
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col divide-y divide-clinic-border border border-clinic-border rounded-[6px] bg-clinic-surface overflow-hidden">
                            {orders.map((o) => {
                                const st = ORDER_STATUS[o.trang_thai] || { label: o.trang_thai, badge: 'medpro-badge-neutral' }
                                const cls = RESULT_CLASS[o.ket_qua_phan_loai]
                                const hasResult = o.trang_thai === 'da_co_ket_qua'

                                return (
                                    <div
                                        key={o.id}
                                        className={`flex flex-col gap-1.5 p-3 transition ${
                                            hasResult ? 'bg-clinic-success-bg/50' : 'bg-clinic-surface'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <span className="text-[13px] font-bold text-clinic-navy leading-snug">
                                                {o.ten_dich_vu}
                                            </span>
                                            <span className={`shrink-0 text-[11px] font-bold ${
                                                hasResult ? 'medpro-badge-success' : 'medpro-badge-warning'
                                            }`}>
                                                {st.label}
                                            </span>
                                        </div>

                                        {hasResult ? (
                                            <div className="flex items-center justify-between pt-1 border-t border-clinic-border">
                                                <span className={`text-[12px] font-semibold ${
                                                    o.ket_qua_phan_loai && o.ket_qua_phan_loai !== 'BINH_THUONG' ? 'text-clinic-danger' : 'text-clinic-success'
                                                }`}>
                                                    {cls?.label || 'Đã có kết quả'}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => setViewingOrder(o)}
                                                    className="inline-flex items-center gap-1 text-xs font-bold text-clinic-cta hover:underline cursor-pointer"
                                                >
                                                    <ClinicIcon name="Eye" size={13} />
                                                    Xem kết quả
                                                </button>
                                            </div>
                                        ) : (
                                            <span className="text-[11px] text-clinic-text-secondary">
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

            {activeTab === 'history' && (
                <div className="p-3.5 flex flex-col gap-3 max-h-[75vh] overflow-y-auto">
                    <span className="text-xs font-bold text-clinic-navy">
                        Lịch sử các lần khám trước
                    </span>

                    <div className="flex flex-col divide-y divide-clinic-border border border-clinic-border rounded-[6px] bg-clinic-surface overflow-hidden">
                        {displayHistory.map((h, idx) => (
                            <div
                                key={h.id || idx}
                                className="p-3 flex flex-col gap-2 bg-clinic-surface hover:bg-clinic-bg/60 transition"
                            >
                                <div className="flex items-center justify-between text-xs text-clinic-text-secondary border-b border-clinic-border pb-1.5 tabular-nums">
                                    <span className="inline-flex items-center gap-1 font-semibold text-clinic-navy">
                                        <ClinicIcon name="Calendar" size={13} />
                                        <span>{formatDate(h.ngay)}</span>
                                    </span>
                                    <span>{h.bac_si}</span>
                                </div>

                                <div>
                                    <span className="text-[11px] font-semibold text-clinic-text-secondary">Chẩn đoán</span>
                                    <p className="text-[13px] font-bold text-clinic-navy leading-snug">{h.chan_doan}</p>
                                </div>

                                {h.items && h.items.length > 0 && (
                                    <div className="mt-1 flex flex-col gap-1 bg-clinic-bg rounded-[6px] p-2 text-xs">
                                        <span className="text-[11px] font-bold text-clinic-text-secondary tabular-nums">
                                            Đơn thuốc ({h.items.length} loại)
                                        </span>
                                        <ul className="list-disc list-inside space-y-0.5 text-clinic-text">
                                            {h.items.slice(0, 3).map((item, i) => (
                                                <li key={i} className="truncate">
                                                    {item.ten_thuoc} {item.ham_luong ? `(${item.ham_luong})` : ''}
                                                </li>
                                            ))}
                                            {h.items.length > 3 && (
                                                <li className="text-clinic-text-secondary">và {h.items.length - 3} thuốc khác...</li>
                                            )}
                                        </ul>
                                    </div>
                                )}

                                {!locked && h.items && h.items.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => handleApplyOld(h)}
                                        className="medpro-btn-outline mt-1 w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-bold cursor-pointer"
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

            {activeTab === 'templates' && (
                <div className="p-3.5 flex flex-col gap-3 max-h-[75vh] overflow-y-auto">
                    <div className="flex flex-col gap-1.5">
                        <span className="text-xs font-bold text-clinic-navy">
                            Phác đồ đơn thuốc mẫu
                        </span>
                        <input
                            type="search"
                            aria-label="Tìm phác đồ đơn thuốc mẫu"
                            className="w-full text-xs rounded-[6px] border border-clinic-border bg-clinic-surface text-clinic-text px-3 py-1.5 outline-none focus:border-clinic-cta"
                            placeholder="Tìm theo bệnh: dạ dày, viêm họng, sốt..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex flex-col divide-y divide-clinic-border border border-clinic-border rounded-[6px] bg-clinic-surface overflow-hidden">
                        {filteredTemplates.map((tmpl) => (
                            <div
                                key={tmpl.id}
                                className="p-3 flex flex-col gap-2 bg-clinic-surface hover:bg-clinic-bg/60 transition"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <span className="text-[13px] font-bold text-clinic-navy leading-snug">
                                        {tmpl.name}
                                    </span>
                                    <span className="medpro-badge-warning shrink-0 text-[10px]">
                                        {tmpl.category}
                                    </span>
                                </div>

                                <div className="bg-clinic-bg rounded-[6px] p-2 text-xs">
                                    <span className="text-[11px] font-bold text-clinic-text-secondary tabular-nums">
                                        Gồm {tmpl.items.length} thuốc phác đồ
                                    </span>
                                    <ul className="mt-1 list-disc list-inside text-clinic-text space-y-0.5">
                                        {tmpl.items.slice(0, 3).map((it, i) => (
                                            <li key={i} className="truncate">
                                                {it.ten_thuoc}
                                            </li>
                                        ))}
                                        {tmpl.items.length > 3 && (
                                            <li className="text-clinic-text-secondary">và {tmpl.items.length - 3} thuốc khác...</li>
                                        )}
                                    </ul>
                                </div>

                                {!locked && (
                                    <button
                                        type="button"
                                        onClick={() => handleApplyTemplate(tmpl)}
                                        className="medpro-btn-outline w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-bold cursor-pointer"
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
