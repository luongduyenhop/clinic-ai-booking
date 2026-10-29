import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Modal } from 'antd'
import { approveOrderAsync } from '../../../redux/actions/doctor/clinicalAction'
import { CLS_APPROVER_ROLES } from '../../../utils/constants/System'
import { RESULT_CLASS } from '../../../utils/constants/clinical'
import { formatDateTime } from '../../../utils/helpers/formatDate'
import { AppToast } from '../../common/AppNotification'
import { ClinicIcon } from '../../common/ClinicIcon'
import ClsResultPrintModal from './ClsResultPrintModal'

// Duyệt & trả kết quả (xét nghiệm, CĐHA) và in phiếu: hiện dưới form nhập kết quả trên bàn KTV
export default function ClsApprovalBar({ order }) {
    const dispatch = useDispatch()
    const role = String(useSelector((state) => state.app.auth.role) || '').toUpperCase()
    const canApprove = CLS_APPROVER_ROLES.includes(role)
    const [approving, setApproving] = useState(false)
    const [printOpen, setPrintOpen] = useState(false)

    const approved = order.trang_thai === 'da_co_ket_qua' && Boolean(order.thoi_gian_duyet || order.trang_thai_ket_qua === 'DA_DUYET')
    const ready = order.trang_thai === 'dang_thuc_hien' && order.trang_thai_ket_qua === 'DA_CO_KET_QUA'
    if (!approved && !ready) return null

    const approve = async () => {
        setApproving(true)
        try {
            await dispatch(approveOrderAsync(order.id)).unwrap()
            AppToast.success(`Đã duyệt & trả kết quả ${order.ten_dich_vu} cho bác sĩ chỉ định`)
        } catch (msg) {
            AppToast.error(msg)
        } finally {
            setApproving(false)
        }
    }

    // Bước 2: xác nhận lại trước khi khóa kết quả và gửi bác sĩ
    const confirmApprove = () => {
        const cls = RESULT_CLASS[order.ket_qua_phan_loai]
        Modal.confirm({
            title: 'Duyệt & trả kết quả cho bác sĩ?',
            content: (
                <div className="space-y-1.5 text-[13px]">
                    <p>
                        <strong>{order.ten_dich_vu}</strong> — {order.benh_nhan?.ho_ten}
                        {cls && (
                            <>
                                {' · '}
                                <span className={cls.badge}>{cls.label}</span>
                            </>
                        )}
                    </p>
                    <p className="text-slate-600">
                        Sau khi duyệt, kết quả hiện ngay trên Bàn khám của {order.bac_si_chi_dinh} và <strong>không thể sửa</strong> kết quả hay
                        thay đổi ảnh.
                    </p>
                </div>
            ),
            okText: 'Duyệt & Trả kết quả',
            cancelText: 'Xem lại',
            onOk: approve,
        })
    }

    return (
        <div
            className={`flex flex-wrap items-center gap-3 rounded-xl px-4 py-3 text-[13px] ${
                approved ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'
            }`}
        >
            <ClinicIcon name={approved ? 'SealCheck' : 'WarningCircle'} size={20} weight="fill" className="shrink-0" />
            <div className="min-w-[220px] flex-1">
                {approved ? (
                    <>
                        <div className="font-bold">Đã duyệt & trả kết quả — kết quả đã khóa</div>
                        <div>
                            {formatDateTime(order.thoi_gian_duyet || order.thoi_gian_tra_ket_qua)}
                            {order.nguoi_duyet && ` · ${order.nguoi_duyet}`}
                        </div>
                    </>
                ) : (
                    <>
                        <div className="font-bold">Kết quả đã hoàn tất, chờ duyệt</div>
                        <div>
                            {canApprove
                                ? 'Kiểm tra lại rồi bấm “Duyệt & Trả kết quả” để gửi bác sĩ chỉ định.'
                                : 'Kỹ thuật viên phòng CLS sẽ duyệt & trả kết quả cho bác sĩ.'}
                        </div>
                    </>
                )}
            </div>
            {ready && canApprove && (
                <button type="button" className="medpro-btn-primary" disabled={approving} onClick={confirmApprove}>
                    <ClinicIcon name="SealCheck" size={16} weight="bold" />
                    {approving ? 'Đang duyệt…' : 'Duyệt & Trả kết quả'}
                </button>
            )}
            {approved && (
                <button type="button" className="medpro-btn-outline" onClick={() => setPrintOpen(true)}>
                    <ClinicIcon name="Printer" size={16} /> In phiếu kết quả
                </button>
            )}
            {printOpen && <ClsResultPrintModal orderId={order.id} open={printOpen} onClose={() => setPrintOpen(false)} />}
        </div>
    )
}
