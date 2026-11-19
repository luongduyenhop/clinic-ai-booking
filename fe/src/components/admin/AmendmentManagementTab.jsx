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
            <div className="p-4 rounded-[6px] bg-clinic-surface-tint border border-clinic-info-border flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h3 className="font-display text-sm font-extrabold text-clinic-navy uppercase flex items-center gap-2">
                        <ShieldCheck size={17} className="text-clinic-cta" />
                        <span>Hội đồng chuyên môn: Phê duyệt biên bản đính chính bệnh án EMR</span>
                    </h3>
                    <p className="text-xs text-clinic-text-secondary mt-0.5">
                        Quy trình tuân thủ Thông tư 32/2023/TT-BYT &amp; Điều 69 Luật Khám bệnh, chữa bệnh 2023 theo nguyên tắc Bốn Mắt.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={fetchAmendments}
                    disabled={loading}
                    className="medpro-btn-outline !py-1.5 !px-3 text-xs"
                >
                    <ArrowsClockwise size={13} className={loading ? 'animate-spin' : ''} />
                    <span>Làm mới ({amendments.length})</span>
                </button>
            </div>

            <div className="medpro-card p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-1 bg-clinic-bg-muted p-1 rounded-[6px] border border-clinic-border">
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
                                className={`px-3 py-1 rounded-[6px] text-xs font-bold transition-colors cursor-pointer ${
                                    filter === tab.key
                                        ? 'bg-clinic-navy text-clinic-surface'
                                        : 'text-clinic-text-secondary hover:text-clinic-navy'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    <div className="relative w-full sm:w-64">
                        <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-clinic-text-muted pointer-events-none" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Tìm bệnh nhân, bác sĩ, lý do..."
                            className="medpro-input !py-1.5 h-9 !pl-8 text-xs w-full"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto rounded-[6px] border border-clinic-border">
                    <table className="medpro-table text-xs tabular-nums">
                        <thead>
                            <tr>
                                <th>Mã BB</th>
                                <th>Ca khám / BN</th>
                                <th>Bác sĩ đề xuất</th>
                                <th>Phần sửa</th>
                                <th>Mức độ</th>
                                <th>Lý do đính chính</th>
                                <th>Trạng thái</th>
                                <th className="text-right">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="p-8 text-center text-clinic-text-muted">
                                        Không có biên bản đính chính nào phù hợp bộ lọc
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((item) => (
                                    <tr key={item.id}>
                                        <td className="font-mono font-bold text-clinic-navy">
                                            BB-{item.id}
                                            <div className="text-[10.5px] text-clinic-text-muted font-normal">
                                                {formatDateTime(item.created_at)}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="font-bold text-clinic-navy">
                                                {item.ten_benh_nhan || 'Bệnh nhân'}
                                            </div>
                                            <div className="text-[11px] text-clinic-text-secondary font-mono">
                                                Mã KCB: {item.ma_kcb || `LK-${item.luot_kham_id}`}
                                            </div>
                                        </td>
                                        <td className="font-medium text-clinic-text">
                                            {item.ten_bac_si_yeu_cau || `BS #${item.requested_by_id}`}
                                        </td>
                                        <td>
                                            <span className="medpro-badge-info">
                                                {item.thuc_the_loai === 'CHAN_DOAN' && 'Chẩn đoán'}
                                                {item.thuc_the_loai === 'DON_THUOC' && 'Đơn thuốc'}
                                                {(item.thuc_the_loai === 'CHI_DINH' || item.thuc_the_loai === 'CHI_DINH_CLS') && 'Chỉ định CLS'}
                                                {item.thuc_the_loai === 'KET_LUAN' && 'Kết luận điều trị'}
                                                {!['CHAN_DOAN', 'DON_THUOC', 'CHI_DINH', 'CHI_DINH_CLS', 'KET_LUAN'].includes(item.thuc_the_loai) && item.thuc_the_loai}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={
                                                item.muc_do_nghiem_trong === 'CAO'
                                                    ? 'medpro-badge-danger'
                                                    : item.muc_do_nghiem_trong === 'TRUNG_BINH'
                                                    ? 'medpro-badge-warning'
                                                    : 'medpro-badge-success'
                                            }>
                                                {item.muc_do_nghiem_trong || 'TRUNG_BINH'}
                                            </span>
                                        </td>
                                        <td className="max-w-xs truncate text-clinic-text-secondary" title={item.ly_do_text}>
                                            {item.ly_do_text}
                                        </td>
                                        <td>
                                            <span className={
                                                item.trang_thai === 'DA_PHE_DUYET'
                                                    ? 'medpro-badge-success'
                                                    : item.trang_thai === 'TU_CHOI'
                                                    ? 'medpro-badge-danger'
                                                    : 'medpro-badge-warning'
                                            }>
                                                {item.trang_thai === 'CHO_PHE_DUYET' && 'Chờ phê duyệt'}
                                                {item.trang_thai === 'DA_PHE_DUYET' && 'Đã phê duyệt'}
                                                {item.trang_thai === 'TU_CHOI' && 'Từ chối'}
                                            </span>
                                        </td>
                                        <td className="text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedAmendment(item)}
                                                    className="medpro-btn-outline text-xs !py-1 !px-2.5"
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
                                                            className="px-2.5 py-1 rounded-[6px] text-xs font-bold bg-clinic-success text-clinic-surface hover:opacity-90 transition-opacity inline-flex items-center gap-1 cursor-pointer"
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
                                                            className="medpro-btn-danger !py-1 !px-2.5 text-xs"
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
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-clinic-navy-dark/50">
                    <div className="relative w-full max-w-lg bg-clinic-surface rounded-[6px] shadow-xs border border-clinic-border overflow-hidden flex flex-col max-h-[90vh]">
                        <div className={`px-4 py-3 flex items-center justify-between border-b ${
                            actionModal.type === 'APPROVE'
                                ? 'bg-clinic-navy text-clinic-surface border-clinic-navy-dark'
                                : 'bg-clinic-danger-bg text-clinic-danger border-clinic-danger-border'
                        }`}>
                            <div className="flex items-center gap-2">
                                <ShieldCheck size={18} weight="bold" />
                                <h3 className="font-display text-sm font-bold">
                                    {actionModal.type === 'APPROVE' ? 'Phê duyệt biên bản đính chính' : 'Từ chối biên bản đính chính'} #{actionModal.amendment.id}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setActionModal(null)}
                                className="w-7 h-7 rounded-[6px] flex items-center justify-center hover:opacity-75 cursor-pointer"
                            >
                                <X size={15} weight="bold" />
                            </button>
                        </div>
                        <div className="p-4 space-y-3.5 overflow-y-auto text-xs tabular-nums">
                            <dl className="divide-y divide-clinic-border rounded-[6px] border border-clinic-border bg-clinic-bg px-3">
                                <div className="flex justify-between py-2">
                                    <dt className="text-clinic-text-secondary">Ca khám:</dt>
                                    <dd className="font-mono font-bold text-clinic-navy">{actionModal.amendment.ma_kcb || `LK-${actionModal.amendment.luot_kham_id}`}</dd>
                                </div>
                                <div className="flex justify-between py-2">
                                    <dt className="text-clinic-text-secondary">Người bệnh:</dt>
                                    <dd className="font-bold text-clinic-navy">{actionModal.amendment.ten_benh_nhan || 'Bệnh nhân'}</dd>
                                </div>
                                <div className="flex justify-between py-2">
                                    <dt className="text-clinic-text-secondary">Bác sĩ đề xuất:</dt>
                                    <dd className="font-semibold text-clinic-navy">{actionModal.amendment.ten_bac_si_yeu_cau || `BS #${actionModal.amendment.requested_by_id}`}</dd>
                                </div>
                                <div className="py-2">
                                    <dt className="text-clinic-text-secondary mb-0.5">Lý do đính chính:</dt>
                                    <dd className="text-clinic-text">{actionModal.amendment.ly_do_text}</dd>
                                </div>
                            </dl>

                            {actionModal.type === 'APPROVE' && actionModal.amendment.muc_do_nghiem_trong === 'CAO' && (
                                <section className="p-3 rounded-[6px] bg-clinic-warning-bg border border-clinic-warning-border text-clinic-navy space-y-2">
                                    <div className="font-bold flex items-center gap-1.5 text-clinic-warning">
                                        <WarningCircle size={15} weight="fill" className="shrink-0" />
                                        <span>Yêu cầu kiểm thảo chuyên môn (Điều 69 Luật KCB 2023)</span>
                                    </div>
                                    <p className="leading-relaxed text-clinic-text-secondary">
                                        Sửa đổi mức độ CAO can thiệp chẩn đoán ICD-10 hoặc đơn thuốc đã cấp bắt buộc có biên bản kiểm thảo của Hội đồng chuyên môn.
                                    </p>
                                    <div>
                                        <label className="medpro-label">Số văn bản kiểm thảo *</label>
                                        <input
                                            type="text"
                                            value={modalMaKiemThao}
                                            onChange={(e) => setModalMaKiemThao(e.target.value)}
                                            placeholder="Ví dụ: BBKT-2026/01 hoặc HDCM-05"
                                            className="medpro-input !py-1.5 h-9 text-xs bg-clinic-surface"
                                        />
                                    </div>
                                </section>
                            )}

                            <div>
                                <label className="medpro-label">
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
                        <div className="px-4 py-3 bg-clinic-bg border-t border-clinic-border flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setActionModal(null)}
                                className="medpro-btn-outline !py-1.5 !px-3 text-xs"
                            >
                                Hủy bỏ
                            </button>
                            <button
                                type="button"
                                disabled={submitting}
                                onClick={handleConfirmAction}
                                className={actionModal.type === 'APPROVE' ? 'medpro-btn-primary !py-1.5 !px-3.5 text-xs' : 'medpro-btn-danger !py-1.5 !px-3.5 text-xs font-bold'}
                            >
                                {submitting ? 'Đang lưu...' : actionModal.type === 'APPROVE' ? 'Xác nhận phê duyệt' : 'Xác nhận từ chối'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {selectedAmendment && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-clinic-navy-dark/50">
                    <div className="relative w-full max-w-2xl bg-clinic-surface rounded-[6px] shadow-xs border border-clinic-border overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-4 py-3 bg-clinic-navy text-clinic-surface flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <ShieldCheck size={18} className="text-clinic-cyan" />
                                <h3 className="font-display text-sm font-bold">
                                    Biên bản đính chính bệnh án #BB-{selectedAmendment.id}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedAmendment(null)}
                                className="w-7 h-7 rounded-[6px] hover:bg-[color:var(--clinic-nav-hover)] flex items-center justify-center text-clinic-surface cursor-pointer"
                            >
                                <X size={15} weight="bold" />
                            </button>
                        </div>
                        <div className="p-4 space-y-3.5 overflow-y-auto text-xs tabular-nums">
                            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-clinic-bg rounded-[6px] border border-clinic-border">
                                <div><dt className="text-clinic-text-secondary">Ca khám:</dt><dd className="font-bold text-clinic-navy font-mono">{selectedAmendment.ma_kcb || `LK-${selectedAmendment.luot_kham_id}`}</dd></div>
                                <div><dt className="text-clinic-text-secondary">Bệnh nhân:</dt><dd className="font-bold text-clinic-navy">{selectedAmendment.ten_benh_nhan || 'Bệnh nhân'}</dd></div>
                                <div><dt className="text-clinic-text-secondary">Bác sĩ đề xuất:</dt><dd className="font-bold text-clinic-navy">{selectedAmendment.ten_bac_si_yeu_cau || `BS #${selectedAmendment.requested_by_id}`}</dd></div>
                                <div><dt className="text-clinic-text-secondary">Mức độ:</dt><dd className="font-bold text-clinic-navy uppercase">{selectedAmendment.muc_do_nghiem_trong}</dd></div>
                            </dl>

                            <p role="note" className="p-3 bg-clinic-warning-bg rounded-[6px] border border-clinic-warning-border text-clinic-navy leading-relaxed">
                                <strong className="block mb-0.5 text-clinic-warning">Lý do đính chính:</strong>
                                {selectedAmendment.ly_do_text}
                            </p>

                            <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <article className="p-3 bg-clinic-bg rounded-[6px] border border-clinic-border space-y-2">
                                    <span className="font-bold text-clinic-navy block border-b border-clinic-border pb-1">
                                        Bản ghi gốc
                                    </span>
                                    <pre className="font-mono text-[11px] text-clinic-text-secondary whitespace-pre-wrap overflow-x-auto bg-clinic-surface p-2.5 rounded-[6px] border border-clinic-border">
                                        {selectedAmendment.noi_dung_cu_json ? JSON.stringify(selectedAmendment.noi_dung_cu_json, null, 2) : 'Chưa có bản ghi gốc'}
                                    </pre>
                                </article>
                                <article className="p-3 bg-clinic-success-bg rounded-[6px] border border-clinic-success-border space-y-2">
                                    <span className="font-bold text-clinic-success block border-b border-clinic-success-border pb-1">
                                        Đề xuất điều chỉnh
                                    </span>
                                    <pre className="font-mono text-[11px] text-clinic-navy whitespace-pre-wrap overflow-x-auto bg-clinic-surface p-2.5 rounded-[6px] border border-clinic-success-border">
                                        {selectedAmendment.noi_dung_moi_json ? JSON.stringify(selectedAmendment.noi_dung_moi_json, null, 2) : 'Trống'}
                                    </pre>
                                </article>
                            </section>

                            {selectedAmendment.ma_kiem_thao && (
                                <p role="note" className="p-3 bg-clinic-surface-alt rounded-[6px] border border-clinic-info-border text-clinic-navy">
                                    <strong className="mr-1.5">Biên bản kiểm thảo Hội đồng:</strong>
                                    <span className="font-mono font-bold text-clinic-cta">{selectedAmendment.ma_kiem_thao}</span>
                                </p>
                            )}

                            {selectedAmendment.approved_by_id && (
                                <p role="note" className="p-3 bg-clinic-bg rounded-[6px] border border-clinic-border text-clinic-text-secondary">
                                    <span>Đánh giá bởi: </span>
                                    <strong className="text-clinic-navy">{selectedAmendment.ten_nguoi_duyet || `Người dùng #${selectedAmendment.approved_by_id}`}</strong>
                                    <span> lúc {formatDateTime(selectedAmendment.approved_at)}</span>
                                    {selectedAmendment.ghi_chu && <span className="block mt-1">{selectedAmendment.ghi_chu}</span>}
                                </p>
                            )}
                        </div>
                        <div className="px-4 py-3 bg-clinic-bg border-t border-clinic-border flex items-center justify-between">
                            <button
                                type="button"
                                onClick={() => setSelectedAmendment(null)}
                                className="medpro-btn-outline !py-1.5 !px-3 text-xs"
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
                                        className="px-3 py-1.5 rounded-[6px] text-xs font-bold bg-clinic-success text-clinic-surface hover:opacity-90 transition-opacity inline-flex items-center gap-1 cursor-pointer"
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
                                        className="medpro-btn-danger !py-1.5 !px-3 text-xs"
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
