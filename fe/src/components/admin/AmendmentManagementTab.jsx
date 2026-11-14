import { useState, useEffect } from 'react'
import { AppToast } from '../common/AppNotification'
import { adminService } from '../../services/admin/AdminService'
import { formatDateTime } from '../../utils/helpers/formatDate'
import {
    ShieldCheck,
    ArrowsClockwise,
    MagnifyingGlass,
    Eye,
    Check,
    X,
    WarningCircle,
} from '../common/ClinicIcon'

export default function AmendmentManagementTab({ onPendingCountChange }) {
    const [amendments, setAmendments] = useState([])
    const [loading, setLoading] = useState(false)
    const [filter, setFilter] = useState('ALL')
    const [search, setSearch] = useState('')
    const [selectedAmendment, setSelectedAmendment] = useState(null)
    const [actionModal, setActionModal] = useState(null)
    const [modalMaKiemThao, setModalMaKiemThao] = useState('')
    const [modalGhiChu, setModalGhiChu] = useState('')
    const [submitting, setSubmitting] = useState(false)

    const fetchAmendments = async () => {
        setLoading(true)
        try {
            const data = await adminService.getAmendments(filter)
            const list = Array.isArray(data) ? data : []
            setAmendments(list)
            const pendingCount = list.filter((a) => a.trang_thai === 'CHO_PHE_DUYET').length
            if (typeof onPendingCountChange === 'function') {
                onPendingCountChange(pendingCount)
            }
        } catch {
            setAmendments([])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchAmendments()
    }, [filter])

    const handleConfirmAction = async () => {
        if (!actionModal) return
        const { type, amendment } = actionModal
        if (type === 'APPROVE' && amendment.muc_do_nghiem_trong === 'CAO' && !modalMaKiemThao.trim()) {
            AppToast.error('Yêu cầu đính chính mức độ CAO bắt buộc nhập Số biên bản kiểm thảo của Hội đồng chuyên môn!')
            return
        }
        setSubmitting(true)
        try {
            if (type === 'APPROVE') {
                await adminService.approveAmendment(amendment.id, {
                    ma_kiem_thao: modalMaKiemThao.trim() || null,
                    ghi_chu: modalGhiChu.trim() || null,
                })
                AppToast.success(`Phê duyệt biên bản đính chính #${amendment.id} thành công!`)
            } else {
                await adminService.rejectAmendment(amendment.id, {
                    ghi_chu: modalGhiChu.trim() || null,
                })
                AppToast.success(`Đã từ chối biên bản đính chính #${amendment.id}!`)
            }
            setActionModal(null)
            setSelectedAmendment(null)
            setModalMaKiemThao('')
            setModalGhiChu('')
            await fetchAmendments()
        } catch (err) {
            AppToast.error(err?.response?.data?.message || err?.message || 'Thao tác thất bại')
        } finally {
            setSubmitting(false)
        }
    }

    const filtered = amendments.filter((item) => {
        if (!search.trim()) return true
        const q = search.toLowerCase()
        return (
            String(item.id).includes(q) ||
            (item.ten_benh_nhan && item.ten_benh_nhan.toLowerCase().includes(q)) ||
            (item.ma_benh_nhan && item.ma_benh_nhan.toLowerCase().includes(q)) ||
            (item.ma_kcb && item.ma_kcb.toLowerCase().includes(q)) ||
            (item.ten_bac_si_yeu_cau && item.ten_bac_si_yeu_cau.toLowerCase().includes(q)) ||
            (item.ly_do_text && item.ly_do_text.toLowerCase().includes(q))
        )
    })

    return (
        <div className="space-y-4">
            <div className="medpro-card p-4 space-y-3 bg-gradient-to-r from-sky-50 to-white border-l-4 border-l-[#00B5F1]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h3 className="text-sm font-extrabold text-[#003553] flex items-center gap-2">
                            <ShieldCheck size={18} className="text-[#00B5F1]" />
                            <span>HỘI ĐỒNG CHUYÊN MÔN: PHÊ DUYỆT BIÊN BẢN ĐÍNH CHÍNH BỆNH ÁN EMR</span>
                        </h3>
                        <p className="text-xs text-slate-600 mt-0.5">
                            Quy trình tuân thủ Thông tư 32/2023/TT-BYT & Điều 69 Luật Khám bệnh, chữa bệnh 2023. Nghiêm ngặt áp dụng nguyên tắc Bốn Mắt (Four-Eyes Principle).
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={fetchAmendments}
                        disabled={loading}
                        className="medpro-btn-outline text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                        <ArrowsClockwise size={13} className={loading ? 'animate-spin' : ''} />
                        <span>Làm mới ({amendments.length})</span>
                    </button>
                </div>
            </div>

            <div className="medpro-card p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                        {[
                            { key: 'ALL', label: 'Tất cả' },
                            { key: 'CHO_PHE_DUYET', label: 'Chờ duyệt' },
                            { key: 'DA_PHE_DUYET', label: 'Đã duyệt' },
                            { key: 'TU_CHOI', label: 'Từ chối' },
                        ].map((tab) => (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => setFilter(tab.key)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                                    filter === tab.key
                                        ? 'bg-[#003553] text-white shadow-xs'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    <div className="relative w-full sm:w-64">
                        <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Tìm bệnh nhân, bác sĩ, lý do..."
                            className="medpro-input pl-8 text-xs w-full"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-xs text-slate-700">
                        <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                            <tr>
                                <th className="p-3">Mã BB</th>
                                <th className="p-3">Ca khám / BN</th>
                                <th className="p-3">Bác sĩ đề xuất</th>
                                <th className="p-3">Phần sửa</th>
                                <th className="p-3">Mức độ</th>
                                <th className="p-3">Lý do đính chính</th>
                                <th className="p-3">Trạng thái</th>
                                <th className="p-3 text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="p-8 text-center text-slate-400">
                                        Không có biên bản đính chính nào phù hợp bộ lọc
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-50/80 transition">
                                        <td className="p-3 font-mono font-bold text-[#003553]">
                                            BB-{item.id}
                                            <div className="text-[10px] text-slate-400 font-normal">
                                                {formatDateTime(item.created_at)}
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            <div className="font-bold text-slate-900">
                                                {item.ten_benh_nhan || 'Bệnh nhân'}
                                            </div>
                                            <div className="text-[11px] text-slate-500 font-mono">
                                                Mã KCB: {item.ma_kcb || `LK-${item.luot_kham_id}`}
                                            </div>
                                        </td>
                                        <td className="p-3 font-medium">
                                            {item.ten_bac_si_yeu_cau || `BS #${item.requested_by_id}`}
                                        </td>
                                        <td className="p-3">
                                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800">
                                                {item.thuc_the_loai === 'CHAN_DOAN' && 'Chẩn đoán'}
                                                {item.thuc_the_loai === 'DON_THUOC' && 'Đơn thuốc'}
                                                {(item.thuc_the_loai === 'CHI_DINH' || item.thuc_the_loai === 'CHI_DINH_CLS') && 'Chỉ định CLS'}
                                                {item.thuc_the_loai === 'KET_LUAN' && 'Kết luận điều trị'}
                                                {!['CHAN_DOAN', 'DON_THUOC', 'CHI_DINH', 'CHI_DINH_CLS', 'KET_LUAN'].includes(item.thuc_the_loai) && item.thuc_the_loai}
                                            </span>
                                        </td>
                                        <td className="p-3">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                                item.muc_do_nghiem_trong === 'CAO'
                                                    ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                                    : item.muc_do_nghiem_trong === 'TRUNG_BINH'
                                                      ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                                      : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                            }`}>
                                                {item.muc_do_nghiem_trong || 'TRUNG_BINH'}
                                            </span>
                                        </td>
                                        <td className="p-3 max-w-xs truncate" title={item.ly_do_text}>
                                            {item.ly_do_text}
                                        </td>
                                        <td className="p-3">
                                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                                item.trang_thai === 'DA_PHE_DUYET'
                                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                    : item.trang_thai === 'TU_CHOI'
                                                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                                      : 'bg-amber-50 text-amber-700 border border-amber-200 animate-pulse'
                                            }`}>
                                                {item.trang_thai === 'CHO_PHE_DUYET' && 'Chờ phê duyệt'}
                                                {item.trang_thai === 'DA_PHE_DUYET' && 'Đã phê duyệt'}
                                                {item.trang_thai === 'TU_CHOI' && 'Từ chối'}
                                            </span>
                                        </td>
                                        <td className="p-3 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedAmendment(item)}
                                                    className="medpro-btn-outline text-xs !py-1 !px-2.5 flex items-center gap-1 cursor-pointer"
                                                >
                                                    <Eye size={12} />
                                                    <span>Chi tiết</span>
                                                </button>
                                                {item.trang_thai === 'CHO_PHE_DUYET' && (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setActionModal({ type: 'APPROVE', amendment: item })
                                                                setModalMaKiemThao('')
                                                                setModalGhiChu('')
                                                            }}
                                                            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition flex items-center gap-1 cursor-pointer"
                                                        >
                                                            <Check size={12} weight="bold" />
                                                            <span>Duyệt</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setActionModal({ type: 'REJECT', amendment: item })
                                                                setModalGhiChu('')
                                                            }}
                                                            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition flex items-center gap-1 cursor-pointer"
                                                        >
                                                            <X size={12} weight="bold" />
                                                            <span>Từ chối</span>
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {actionModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                    <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
                        <div className={`p-4 text-white flex items-center justify-between ${
                            actionModal.type === 'APPROVE'
                                ? 'bg-gradient-to-r from-emerald-600 to-teal-600'
                                : 'bg-gradient-to-r from-rose-600 to-red-600'
                        }`}>
                            <div className="flex items-center gap-2">
                                <ShieldCheck size={20} weight="bold" />
                                <h3 className="text-sm font-extrabold">
                                    {actionModal.type === 'APPROVE' ? 'PHÊ DUYỆT BIÊN BẢN ĐÍNH CHÍNH' : 'TỪ CHỐI BIÊN BẢN ĐÍNH CHÍNH'} #{actionModal.amendment.id}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setActionModal(null)}
                                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
                            >
                                <X size={16} weight="bold" />
                            </button>
                        </div>
                        <div className="p-5 space-y-4 overflow-y-auto">
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                                <div><span className="text-slate-500">Ca khám:</span> <strong className="font-mono">{actionModal.amendment.ma_kcb || `LK-${actionModal.amendment.luot_kham_id}`}</strong></div>
                                <div><span className="text-slate-500">Người bệnh:</span> <strong>{actionModal.amendment.ten_benh_nhan || 'Bệnh nhân'}</strong></div>
                                <div><span className="text-slate-500">Bác sĩ đề xuất:</span> <strong>{actionModal.amendment.ten_bac_si_yeu_cau || `BS #${actionModal.amendment.requested_by_id}`}</strong></div>
                                <div><span className="text-slate-500">Lý do đính chính:</span> <em>{actionModal.amendment.ly_do_text}</em></div>
                            </div>

                            {actionModal.type === 'APPROVE' && actionModal.amendment.muc_do_nghiem_trong === 'CAO' && (
                                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
                                    <div className="font-extrabold flex items-center gap-1.5 text-amber-950">
                                        <WarningCircle size={16} weight="fill" className="text-amber-600 shrink-0" />
                                        <span>Yêu cầu kiểm thảo chuyên môn (Điều 69 Luật KCB 2023)</span>
                                    </div>
                                    <p className="leading-relaxed">
                                        Biên bản đính chính mức độ CAO can thiệp chẩn đoán ICD-10 hoặc đơn thuốc điều trị đã cấp. Bắt buộc nhập Số biên bản kiểm thảo của Hội đồng chuyên môn.
                                    </p>
                                    <div>
                                        <label className="font-bold block mb-1">Số biên bản kiểm thảo *</label>
                                        <input
                                            type="text"
                                            value={modalMaKiemThao}
                                            onChange={(e) => setModalMaKiemThao(e.target.value)}
                                            placeholder="Ví dụ: BBKT-2026/01 hoặc HDCM-05"
                                            className="medpro-input text-xs w-full bg-white"
                                        />
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="text-xs font-bold text-slate-700 block mb-1">
                                    {actionModal.type === 'APPROVE' ? 'Ghi chú phê duyệt (không bắt buộc)' : 'Lý do từ chối *'}
                                </label>
                                <textarea
                                    rows={3}
                                    value={modalGhiChu}
                                    onChange={(e) => setModalGhiChu(e.target.value)}
                                    placeholder={actionModal.type === 'APPROVE' ? 'Ghi chú hội đồng hoặc căn cứ phê duyệt...' : 'Nêu rõ lý do không đồng ý đính chính...'}
                                    className="medpro-input text-xs w-full"
                                />
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setActionModal(null)}
                                className="medpro-btn-outline text-xs cursor-pointer"
                            >
                                Hủy bỏ
                            </button>
                            <button
                                type="button"
                                disabled={submitting}
                                onClick={handleConfirmAction}
                                className={`text-xs font-bold px-4 py-2 rounded-xl text-white transition flex items-center gap-1.5 cursor-pointer ${
                                    actionModal.type === 'APPROVE'
                                        ? 'bg-emerald-600 hover:bg-emerald-700'
                                        : 'bg-rose-600 hover:bg-rose-700'
                                }`}
                            >
                                {submitting ? 'Đang lưu...' : actionModal.type === 'APPROVE' ? 'Xác nhận phê duyệt' : 'Xác nhận từ chối'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {selectedAmendment && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                    <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-4 bg-[#003553] text-white flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <ShieldCheck size={20} className="text-[#00B5F1]" />
                                <h3 className="text-sm font-extrabold">
                                    BIÊN BẢN ĐÍNH CHÍNH BỆNH ÁN #BB-{selectedAmendment.id}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedAmendment(null)}
                                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
                            >
                                <X size={16} weight="bold" />
                            </button>
                        </div>
                        <div className="p-5 space-y-4 overflow-y-auto text-xs">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                                <div><span className="text-slate-500 block">Ca khám:</span> <strong>{selectedAmendment.ma_kcb || `LK-${selectedAmendment.luot_kham_id}`}</strong></div>
                                <div><span className="text-slate-500 block">Bệnh nhân:</span> <strong>{selectedAmendment.ten_benh_nhan || 'Bệnh nhân'}</strong></div>
                                <div><span className="text-slate-500 block">Bác sĩ đề xuất:</span> <strong>{selectedAmendment.ten_bac_si_yeu_cau || `BS #${selectedAmendment.requested_by_id}`}</strong></div>
                                <div><span className="text-slate-500 block">Mức độ:</span> <strong className="uppercase">{selectedAmendment.muc_do_nghiem_trong}</strong></div>
                            </div>

                            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-950">
                                <span className="font-bold block mb-1">Lý do đính chính:</span>
                                <p className="leading-relaxed">{selectedAmendment.ly_do_text}</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                                    <span className="font-extrabold text-slate-700 block border-b border-slate-200 pb-1">
                                        Nội dung gốc (Trước đính chính)
                                    </span>
                                    <pre className="font-mono text-[11px] text-slate-600 whitespace-pre-wrap overflow-x-auto bg-white p-2.5 rounded-lg border border-slate-200">
                                        {selectedAmendment.noi_dung_cu_json ? JSON.stringify(selectedAmendment.noi_dung_cu_json, null, 2) : 'Chưa có bản ghi gốc'}
                                    </pre>
                                </div>
                                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 space-y-2">
                                    <span className="font-extrabold text-emerald-900 block border-b border-emerald-200 pb-1">
                                        Nội dung đề xuất sửa (Sau đính chính)
                                    </span>
                                    <pre className="font-mono text-[11px] text-emerald-800 whitespace-pre-wrap overflow-x-auto bg-white p-2.5 rounded-lg border border-emerald-200">
                                        {selectedAmendment.noi_dung_moi_json ? JSON.stringify(selectedAmendment.noi_dung_moi_json, null, 2) : 'Trống'}
                                    </pre>
                                </div>
                            </div>

                            {selectedAmendment.ma_kiem_thao && (
                                <div className="p-3 bg-sky-50 rounded-xl border border-sky-200 text-sky-950">
                                    <span className="font-bold block mb-0.5">Số biên bản kiểm thảo Hội đồng chuyên môn:</span>
                                    <span className="font-mono font-bold text-sky-800">{selectedAmendment.ma_kiem_thao}</span>
                                </div>
                            )}

                            {selectedAmendment.approved_by_id && (
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-700">
                                    <span className="text-slate-500">Đánh giá bởi:</span> <strong>{selectedAmendment.ten_nguoi_duyet || `Người dùng #${selectedAmendment.approved_by_id}`}</strong> lúc {formatDateTime(selectedAmendment.approved_at)}
                                    {selectedAmendment.ghi_chu && <div className="mt-1 text-slate-600">{selectedAmendment.ghi_chu}</div>}
                                </div>
                            )}
                        </div>
                        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                            <button
                                type="button"
                                onClick={() => setSelectedAmendment(null)}
                                className="medpro-btn-outline text-xs cursor-pointer"
                            >
                                Đóng
                            </button>
                            {selectedAmendment.trang_thai === 'CHO_PHE_DUYET' && (
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setActionModal({ type: 'APPROVE', amendment: selectedAmendment })
                                            setModalMaKiemThao('')
                                            setModalGhiChu('')
                                        }}
                                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition flex items-center gap-1 cursor-pointer"
                                    >
                                        <Check size={13} weight="bold" />
                                        <span>Phê duyệt</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setActionModal({ type: 'REJECT', amendment: selectedAmendment })
                                            setModalGhiChu('')
                                        }}
                                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition flex items-center gap-1 cursor-pointer"
                                    >
                                        <X size={13} weight="bold" />
                                        <span>Từ chối</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
