import { useState, useEffect } from 'react'
import { Drawer, Tag, Tabs, Button, Alert, Spin, Table, Select, Modal, Input, message } from 'antd'
import {
    SwapOutlined,
    CloseCircleOutlined,
    SyncOutlined,
    ClockCircleOutlined,
    PhoneOutlined,
    UserOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { receptionService } from '../../services/reception/receptionService'
import { unwrapApi } from '../../utils/helpers/apiHelper'

const { TextArea } = Input

export default function IncidentDetailDrawer({ incident, open, onClose, onSuccess }) {
    const [loading, setLoading] = useState(false)
    const [affectedData, setAffectedData] = useState(null)
    const [activeTab, setActiveTab] = useState('hang_doi')

    // Selected tickets in hang_doi
    const [selectedTicketIds, setSelectedTicketIds] = useState([])
    // Specific doctor assignment per ticket: { [ticketId]: doctorId | null }
    const [doctorAssignments, setDoctorAssignments] = useState({})

    // Selected waitlist in hang_cho_waitlist
    const [selectedWaitlistIds, setSelectedWaitlistIds] = useState([])

    // Action states
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [cancelModalOpen, setCancelModalOpen] = useState(false)
    const [cancelMode, setCancelMode] = useState('hang_doi') // 'hang_doi' | 'waitlist'
    const [cancelReason, setCancelReason] = useState('')

    const loadAffectedPatients = async () => {
        if (!incident?.nghi_phep_id) return
        setLoading(true)
        try {
            const res = await receptionService.getIncidentAffectedPatients(incident.nghi_phep_id)
            const data = unwrapApi(res)
            setAffectedData(data)
            setSelectedTicketIds([])
            setSelectedWaitlistIds([])
            setDoctorAssignments({})
        } catch {
            message.error('Không thể tải chi tiết bệnh nhân bị ảnh hưởng')
            setAffectedData(null)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (open && incident?.nghi_phep_id) {
            loadAffectedPatients()
            setCancelReason(`Bác sĩ ${incident.ten_bac_si} nghỉ đột xuất - Bệnh nhân muốn dời lịch sang hôm khác chứ không đổi bác sĩ`)
        } else {
            setAffectedData(null)
            setSelectedTicketIds([])
            setSelectedWaitlistIds([])
            setDoctorAssignments({})
        }
    }, [open, incident?.nghi_phep_id])

    const doctorOptions = [
        { value: null, label: '⚡ Tự động Cân bằng tải (BS ít người chờ nhất)' },
        ...(incident?.danh_sach_bac_si_thay_the || []).map((alt) => ({
            value: alt.bac_si_id,
            label: `BS. ${alt.ten_bac_si} (${alt.phong_kham || 'Buồng'} - Chờ: ${alt.so_benh_nhan_cho} BN)`,
        })),
    ]

    const handleDoctorAssignmentChange = (ticketId, docId) => {
        setDoctorAssignments((prev) => ({
            ...prev,
            [ticketId]: docId,
        }))
    }

    // Thực hiện điều chuyển lẻ các vé đã chọn
    const handleRebalanceSelected = async () => {
        if (selectedTicketIds.length === 0) {
            message.warning('Vui lòng chọn ít nhất 1 bệnh nhân để điều chuyển')
            return
        }

        setIsSubmitting(true)
        try {
            const assignments = selectedTicketIds.map((ticketId) => ({
                ticket_id: ticketId,
                bac_si_nhan_id: doctorAssignments[ticketId] ?? null,
            }))

            const res = await receptionService.rebalanceQueue({
                nghi_phep_bac_si_id: incident.nghi_phep_id,
                assignments,
            })
            const data = unwrapApi(res)
            const count = data?.so_ve_chuyen || selectedTicketIds.length
            message.success(`Đã điều chuyển thành công ${count} bệnh nhân sang bác sĩ thay thế!`)

            await loadAffectedPatients()
            if (onSuccess) onSuccess()
        } catch (err) {
            const errMsg = err?.response?.data?.message || err?.message || 'Điều chuyển hàng đợi thất bại'
            message.error(errMsg)
        } finally {
            setIsSubmitting(false)
        }
    }

    // Mở modal xác nhận hủy
    const openCancelModal = (mode) => {
        if (mode === 'hang_doi' && selectedTicketIds.length === 0) {
            message.warning('Vui lòng chọn ít nhất 1 bệnh nhân trong hàng đợi để hủy')
            return
        }
        if (mode === 'waitlist' && selectedWaitlistIds.length === 0) {
            message.warning('Vui lòng chọn ít nhất 1 lượt waitlist để hủy')
            return
        }
        setCancelMode(mode)
        setCancelModalOpen(true)
    }

    // Thực hiện hủy vé / waitlist do sự cố
    const handleConfirmCancel = async () => {
        setIsSubmitting(true)
        try {
            const payload = {
                nghi_phep_bac_si_id: incident.nghi_phep_id,
                ticket_ids: cancelMode === 'hang_doi' ? selectedTicketIds : [],
                waitlist_ids: cancelMode === 'waitlist' ? selectedWaitlistIds : [],
                ly_do: cancelReason.trim() || `Bác sĩ ${incident.ten_bac_si} nghỉ đột xuất`,
            }

            const res = await receptionService.cancelIncidentTickets(payload)
            const data = unwrapApi(res)
            const msg = data?.thong_diep || `Đã hủy thành công ${data?.so_ve_da_huy || 0} vé hàng đợi và ${data?.so_waitlist_da_huy || 0} lượt waitlist!`
            message.success(msg)

            setCancelModalOpen(false)
            await loadAffectedPatients()
            if (onSuccess) onSuccess()
        } catch (err) {
            const errMsg = err?.response?.data?.message || err?.message || 'Hủy vé thất bại'
            message.error(errMsg)
        } finally {
            setIsSubmitting(false)
        }
    }

    const hangDoiList = affectedData?.hang_doi || []
    const waitlistList = affectedData?.hang_cho_waitlist || []
    const totalStuck = affectedData?.tong_so_kẹt ?? (hangDoiList.length + waitlistList.length)

    const hangDoiColumns = [
        {
            title: 'STT & Mã vé',
            key: 'ticket',
            width: 110,
            render: (_, r) => (
                <div>
                    <Tag color="blue" className="font-mono font-bold text-xs">
                        {r.ma_lich_kham || `STT ${r.so_thu_tu_kham || r.ticket_id}`}
                    </Tag>
                    {r.loai_hang_doi && (
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                            {r.loai_hang_doi === 'dung_hen' ? 'Đúng hẹn' : 'Vãng lai'}
                        </span>
                    )}
                </div>
            ),
        },
        {
            title: 'Bệnh nhân',
            key: 'patient',
            render: (_, r) => (
                <div className="space-y-0.5">
                    <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                        <UserOutlined className="text-sky-600" />
                        <span>{r.ten_benh_nhan}</span>
                    </div>
                    {r.so_dien_thoai && (
                        <div className="text-[11px] text-slate-500 flex items-center gap-1">
                            <PhoneOutlined />
                            <span>{r.so_dien_thoai}</span>
                        </div>
                    )}
                    {r.muc_do_uu_tien === 1 && (
                        <Tag color="red" className="text-[9.5px] leading-tight">Ưu tiên cao</Tag>
                    )}
                </div>
            ),
        },
        {
            title: 'Thời gian',
            key: 'time',
            width: 130,
            render: (_, r) => (
                <div className="text-xs text-slate-600 space-y-0.5">
                    {r.gio_kham && (
                        <div className="flex items-center gap-1">
                            <ClockCircleOutlined className="text-sky-600" />
                            <span>Hẹn: <strong>{r.gio_kham}</strong></span>
                        </div>
                    )}
                    {r.thoi_gian_check_in && (
                        <div className="text-[10.5px] text-slate-400">
                            Check-in: {dayjs(r.thoi_gian_check_in).format('HH:mm')}
                        </div>
                    )}
                </div>
            ),
        },
        {
            title: 'Bác sĩ tiếp nhận (Chỉ định riêng)',
            key: 'assign_doctor',
            width: 270,
            render: (_, r) => (
                <Select
                    size="small"
                    className="w-full text-xs"
                    value={doctorAssignments[r.ticket_id] ?? null}
                    onChange={(val) => handleDoctorAssignmentChange(r.ticket_id, val)}
                    options={doctorOptions}
                />
            ),
        },
    ]

    const waitlistColumns = [
        {
            title: 'Thứ tự',
            dataIndex: 'thu_tu_uu_tien',
            key: 'thu_tu_uu_tien',
            width: 80,
            render: (order) => <Tag color="orange" className="font-mono font-bold">#{order || 1}</Tag>,
        },
        {
            title: 'Bệnh nhân',
            key: 'patient',
            render: (_, r) => (
                <div className="space-y-0.5">
                    <span className="font-bold text-slate-800 text-xs block">{r.ten_benh_nhan}</span>
                    {r.so_dien_thoai && (
                        <span className="text-[11px] text-slate-500 flex items-center gap-1">
                            <PhoneOutlined />
                            <span>{r.so_dien_thoai}</span>
                        </span>
                    )}
                </div>
            ),
        },
        {
            title: 'Ca & Ngày mong muốn',
            key: 'desired',
            render: (_, r) => (
                <span className="text-xs text-slate-700">
                    {r.ca_mong_muon === 'sang' ? 'Ca sáng' : r.ca_mong_muon === 'chieu' ? 'Ca chiều' : r.ca_mong_muon || 'Trong ngày'} • {r.ngay_mong_muon || 'Hôm nay'}
                </span>
            ),
        },
    ]

    return (
        <>
            <Drawer
                title={
                    <div className="flex items-center gap-2">
                        <SwapOutlined className="text-sky-600 text-base" />
                        <div>
                            <span className="font-bold text-slate-800 text-sm">
                                Chi tiết Bệnh nhân bị ảnh hưởng: BS {incident?.ten_bac_si}
                            </span>
                            <span className="text-xs text-slate-400 block font-normal">
                                {incident?.ten_chuyen_khoa} • {incident?.tu_ngay} {incident?.ca_lam_viec ? `(${incident.ca_lam_viec === 'sang' ? 'Ca sáng' : 'Ca chiều'})` : ''}
                            </span>
                        </div>
                    </div>
                }
                open={open}
                onClose={onClose}
                width={820}
                extra={
                    <Button size="small" icon={<SyncOutlined spin={loading} />} onClick={loadAffectedPatients}>
                        Làm mới
                    </Button>
                }
            >
                {loading ? (
                    <div className="py-20 text-center">
                        <Spin tip="Đang tải danh sách bệnh nhân bị kẹt trong sự cố..." />
                    </div>
                ) : !affectedData ? (
                    <Alert
                        type="warning"
                        showIcon
                        message="Không có dữ liệu bệnh nhân bị kẹt"
                        description="Vui lòng thử lại hoặc sự cố này đã được giải phóng toàn bộ."
                    />
                ) : (
                    <div className="space-y-4">
                        {/* Summary Header Card */}
                        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                            <div className="space-y-1">
                                <div>
                                    <span className="text-slate-500">Lý do nghỉ: </span>
                                    <strong className="text-slate-800">{incident?.ly_do || 'Nghỉ đột xuất'}</strong>
                                </div>
                                <div className="text-slate-500">
                                    Bác sĩ thay thế sẵn sàng: <strong>{incident?.danh_sach_bac_si_thay_the?.length || 0} bác sĩ</strong> cùng chuyên khoa
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-slate-400 text-[11px]">Tổng bệnh nhân đang kẹt:</div>
                                <div className="text-2xl font-black text-rose-600 font-mono">
                                    {totalStuck} lượt
                                </div>
                            </div>
                        </div>

                        {totalStuck === 0 ? (
                            <Alert
                                type="success"
                                showIcon
                                message="Sự cố đã được xử lý hoàn tất!"
                                description="Tất cả các lượt khám và hàng chờ của bác sĩ này đã được điều chuyển hoặc xử lý hủy xong. Không còn bệnh nhân nào bị tắc nghẽn."
                            />
                        ) : null}

                        {/* Tabs: Hàng đợi vs Waitlist */}
                        <Tabs
                            activeKey={activeTab}
                            onChange={setActiveTab}
                            items={[
                                {
                                    key: 'hang_doi',
                                    label: `Hàng đợi khám (${hangDoiList.length})`,
                                    children: (
                                        <div className="space-y-3">
                                            {/* Action Bar */}
                                            <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-[#F0F7FC] rounded-xl border border-[#D5E6F2]">
                                                <span className="text-xs text-slate-600 font-medium">
                                                    Đã chọn: <strong className="text-sky-700">{selectedTicketIds.length}</strong> / {hangDoiList.length} bệnh nhân
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        size="small"
                                                        danger
                                                        icon={<CloseCircleOutlined />}
                                                        disabled={selectedTicketIds.length === 0}
                                                        onClick={() => openCancelModal('hang_doi')}
                                                        className="text-xs font-semibold"
                                                    >
                                                        Hủy khám ({selectedTicketIds.length})
                                                    </Button>
                                                    <Button
                                                        size="small"
                                                        type="primary"
                                                        icon={<SwapOutlined />}
                                                        loading={isSubmitting}
                                                        disabled={selectedTicketIds.length === 0}
                                                        onClick={handleRebalanceSelected}
                                                        className="medpro-btn-primary text-xs font-bold"
                                                    >
                                                        ⚡ Điều chuyển vé đã chọn ({selectedTicketIds.length})
                                                    </Button>
                                                </div>
                                            </div>

                                            <Table
                                                columns={hangDoiColumns}
                                                dataSource={hangDoiList}
                                                rowKey="ticket_id"
                                                size="small"
                                                pagination={false}
                                                rowSelection={{
                                                    selectedRowKeys: selectedTicketIds,
                                                    onChange: setSelectedTicketIds,
                                                }}
                                                locale={{ emptyText: 'Không có bệnh nhân nào trong hàng đợi' }}
                                            />
                                        </div>
                                    ),
                                },
                                {
                                    key: 'waitlist',
                                    label: `Hàng chờ Waitlist (${waitlistList.length})`,
                                    children: (
                                        <div className="space-y-3">
                                            {/* Action Bar */}
                                            <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-amber-50/70 rounded-xl border border-amber-200">
                                                <span className="text-xs text-amber-800 font-medium">
                                                    Đã chọn: <strong className="text-amber-900">{selectedWaitlistIds.length}</strong> / {waitlistList.length} lượt chờ
                                                </span>
                                                <Button
                                                    size="small"
                                                    danger
                                                    icon={<CloseCircleOutlined />}
                                                    disabled={selectedWaitlistIds.length === 0}
                                                    onClick={() => openCancelModal('waitlist')}
                                                    className="text-xs font-semibold"
                                                >
                                                    Hủy lượt chờ Waitlist ({selectedWaitlistIds.length})
                                                </Button>
                                            </div>

                                            <Table
                                                columns={waitlistColumns}
                                                dataSource={waitlistList}
                                                rowKey="waitlist_id"
                                                size="small"
                                                pagination={false}
                                                rowSelection={{
                                                    selectedRowKeys: selectedWaitlistIds,
                                                    onChange: setSelectedWaitlistIds,
                                                }}
                                                locale={{ emptyText: 'Không có bệnh nhân nào trong hàng chờ waitlist' }}
                                            />
                                        </div>
                                    ),
                                },
                            ]}
                        />
                    </div>
                )}
            </Drawer>

            {/* Modal Xác nhận hủy khám (Bảo vệ bệnh nhân - Zero Penalty) */}
            <Modal
                title={
                    <div className="flex items-center gap-2 text-rose-600 font-bold">
                        <CloseCircleOutlined />
                        <span>Hủy khám do sự cố bác sĩ nghỉ (Bảo vệ bệnh nhân)</span>
                    </div>
                }
                open={cancelModalOpen}
                onCancel={() => setCancelModalOpen(false)}
                footer={[
                    <Button key="back" onClick={() => setCancelModalOpen(false)}>
                        Đóng
                    </Button>,
                    <Button
                        key="submit"
                        danger
                        type="primary"
                        loading={isSubmitting}
                        onClick={handleConfirmCancel}
                        className="text-xs font-bold"
                    >
                        Xác nhận Hủy ({cancelMode === 'hang_doi' ? selectedTicketIds.length : selectedWaitlistIds.length} lượt)
                    </Button>,
                ]}
            >
                <div className="space-y-3 py-2 text-xs">
                    <Alert
                        type="info"
                        showIcon
                        message="Quy tắc nghiệp vụ bảo vệ người bệnh (Zero-penalty)"
                        description="Hủy vé do bác sĩ nghỉ đột xuất sẽ đóng vé và hủy lịch khám tương ứng. Hệ thống TUYỆT ĐỐI KHÔNG TĂNG SỐ LẦN NO-SHOW của bệnh nhân vì đây là sự cố bất khả kháng từ phòng khám."
                    />

                    <div>
                        <span className="font-bold text-slate-700 block mb-1">
                            Số lượng hủy:
                        </span>
                        <Tag color="volcano" className="font-bold text-xs">
                            {cancelMode === 'hang_doi'
                                ? `${selectedTicketIds.length} lượt hàng đợi khám`
                                : `${selectedWaitlistIds.length} lượt hàng chờ waitlist`}
                        </Tag>
                    </div>

                    <div>
                        <label className="font-bold text-slate-700 block mb-1">
                            Lý do hủy khám / dời lịch: <span className="text-red-500">*</span>
                        </label>
                        <TextArea
                            rows={3}
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            placeholder="Nhập lý do hủy từ phía bệnh nhân hoặc phòng khám..."
                        />
                    </div>
                </div>
            </Modal>
        </>
    )
}
