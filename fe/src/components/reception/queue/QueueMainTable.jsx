import React from 'react'
import { Table, Tag, Button, Tooltip, Dropdown, Empty } from 'antd'
import {
    ClockCircleOutlined,
    SwapOutlined,
    PlayCircleOutlined,
    CloseCircleOutlined,
    HistoryOutlined,
    SoundOutlined,
    PrinterOutlined,
    MedicineBoxOutlined,
    PhoneOutlined,
    MoreOutlined,
    UserOutlined,
} from '@ant-design/icons'

const getQueueTypeTag = (record) => {
    const rawType = String(record.loai_hang_doi || '').toLowerCase().trim()
    if (rawType === 'cap_cuu' || record.isEmergency) {
        return { label: 'Cấp cứu', color: 'red', className: 'font-bold' }
    }
    if (rawType === 'dung_hen') {
        return { label: 'Đúng hẹn', color: 'blue', className: 'font-medium' }
    }
    if (rawType === 'den_som') {
        return { label: 'Đến sớm', color: 'cyan', className: 'font-medium' }
    }
    if (rawType === 'den_muon' || rawType === 'tre_hen') {
        return { label: 'Đến muộn', color: 'volcano', className: 'font-medium' }
    }
    if (rawType === 'co_ket_qua_cls' || rawType === 'sau_cls' || rawType === 'kham_lai' || rawType.includes('cls') || /sau_cls|co_ket_qua|tra_cls|lab return/i.test(record.notes || record.priorityReason || record.patientName || '')) {
        return { label: 'Sau CLS', color: 'geekblue', className: 'font-medium' }
    }
    if (rawType === 'tai_kham' || rawType === 'tai_kham_trong_ngay') {
        return { label: 'Tái khám', color: 'purple', className: 'font-medium' }
    }
    return { label: 'Vãng lai', color: 'orange', className: 'font-medium' }
}

export default function QueueMainTable({
    dataSource,
    loading,
    patients,
    selectedRoomObject,
    selectedRoomId,
    searchQuery,
    activeTab,
    onCallNumber,
    onResume,
    onMarkAbsent,
    onOpenPatientDrawer,
    onPrintReceipt,
    onOpenActionModal,
    onOpenHistoryModal,
    onResetAllFilters,
}) {
    const columns = [
        {
            title: 'STT & Mã Buồng',
            dataIndex: 'ticketNumber',
            key: 'ticketNumber',
            width: 155,
            render: (_, record) => {
                const number = record.ticketNumber || record.ma_so_thu_tu || '01'
                const isEmergencyLevel = record.muc_do_uu_tien === 1 || record.isEmergency || /cấp cứu|cap_cuu/i.test(record.priorityReason || record.notes || '')
                const queueTag = getQueueTypeTag(record)

                return (
                    <div className="flex flex-col gap-1 items-start">
                        <span className="text-base font-black text-clinic-cta tracking-tight font-mono tabular-nums">
                            {number}
                        </span>
                        <div className="flex flex-wrap items-center gap-1">
                            {isEmergencyLevel && (
                                <Tag color="purple" className="m-0 text-[10px] font-bold">
                                    Ưu tiên
                                </Tag>
                            )}

                            {queueTag && (
                                <Tag color={queueTag.color} className={`m-0 text-[10px] ${queueTag.className || ''}`}>
                                    {queueTag.label}
                                </Tag>
                            )}

                            {record.muc_do_uu_tien === 4 && Boolean(record.thoi_gian_xep_hang_lai) && (
                                <Tag color="warning" className="m-0 text-[10px] font-medium">
                                    Đã xếp hàng lại
                                </Tag>
                            )}
                        </div>
                    </div>
                )
            },
        },
        {
            title: 'Bệnh nhân',
            key: 'patient',
            width: 220,
            render: (_, record) => {
                const patient = patients.find((pat) => pat.id === record.patientId)
                const patientName = record.patientName || patient?.fullName || 'Bệnh nhân'
                const patientPhone = record.phone || patient?.phone || ''
                const patientCode = patient?.patientCode || (record.patientId ? `BN-${record.patientId}` : '')
                return (
                    <div>
                        <button
                            type="button"
                            onClick={() => onOpenPatientDrawer(record.patientId)}
                            className="font-bold text-clinic-navy hover:text-clinic-cta hover:underline text-left cursor-pointer block"
                        >
                            {patientName}
                        </button>
                        <div className="text-clinic-text-secondary text-xs flex items-center gap-1.5 mt-0.5 tabular-nums">
                            {patientPhone && (
                                <span className="inline-flex items-center gap-0.5">
                                    <PhoneOutlined className="text-[10px]" />
                                    {patientPhone}
                                </span>
                            )}
                            {patientPhone && patientCode && <span>•</span>}
                            {patientCode && <span className="font-mono text-clinic-text-muted">{patientCode}</span>}
                        </div>
                    </div>
                )
            },
        },
        {
            title: 'Buồng khám & Bác sĩ',
            key: 'room_doctor',
            width: 240,
            render: (_, record) => {
                const roomName = record.roomName || record.phong_kham || 'Buồng khám chung'
                const doctorName = record.doctorName || 'Bác sĩ trực buồng'
                return (
                    <div>
                        <div className="font-semibold text-clinic-navy text-xs flex items-center gap-1.5">
                            <MedicineBoxOutlined className="text-clinic-cta shrink-0" />
                            <span className="truncate">{roomName}</span>
                        </div>
                        <div className="text-clinic-text-secondary text-xs mt-0.5 flex items-center gap-1">
                            <UserOutlined className="text-[11px] text-clinic-text-muted shrink-0" />
                            <span className="truncate">{doctorName}</span>
                        </div>
                    </div>
                )
            },
        },
        {
            title: 'Thời gian & Chờ',
            key: 'time_wait',
            width: 170,
            render: (_, record) => {
                const statusString = String(record.status || '').toLowerCase()
                const isWaiting = statusString === 'waiting' || statusString === 'dang_cho' || statusString === 'cho_kham'
                const isOverdue = record.waitTimeMinutes > 60
                const isWarning = record.waitTimeMinutes > 30 && !isOverdue
                return (
                    <div className="tabular-nums">
                        <div className="text-clinic-text-secondary text-xs flex items-center gap-1">
                            <ClockCircleOutlined className="text-[11px] text-clinic-text-muted" />
                            <span>Check-in: <strong className="text-clinic-navy">{record.checkInTime || '--:--'}</strong></span>
                        </div>
                        {isWaiting && (
                            <div className="mt-1">
                                <span
                                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-[4px] inline-block border ${
                                        isOverdue
                                            ? 'bg-clinic-danger-bg text-clinic-danger border-clinic-danger-border font-bold'
                                            : isWarning
                                                ? 'bg-clinic-warning-bg text-clinic-warning border-clinic-warning-border'
                                                : 'bg-clinic-bg text-clinic-text-secondary border-clinic-border'
                                    }`}
                                >
                                    Đã chờ {record.waitTimeMinutes || 0} phút
                                </span>
                            </div>
                        )}
                    </div>
                )
            },
        },
        {
            title: 'Trạng thái & Lần gọi',
            key: 'status',
            width: 170,
            render: (_, record) => {
                const statusString = String(record.status || '').toLowerCase()
                const isInConsultation = statusString === 'in_consultation' || statusString === 'dang_kham'
                const isDeferred = statusString === 'deferred' || statusString === 'tam_hoan'
                const isCompleted = statusString === 'completed' || statusString === 'da_kham'
                const isAbsent = statusString === 'bo_kham'
                const isClosed = statusString === 'da_dong_ve' || statusString === 'cancelled'
                const isCalled = record.callCount > 0

                return (
                    <div>
                        <div>
                            {isInConsultation ? (
                                <Tag color="processing" className="font-bold">Đang khám</Tag>
                            ) : isDeferred ? (
                                <Tag color="warning" className="font-bold">Tạm hoãn</Tag>
                            ) : isCompleted ? (
                                <Tag color="success">Đã khám</Tag>
                            ) : isAbsent ? (
                                <Tag color="default" className="text-clinic-text-secondary font-semibold bg-clinic-bg-muted border-clinic-border">Vắng mặt</Tag>
                            ) : isClosed ? (
                                <Tag color="error" className="font-semibold">Đã đóng / Hủy</Tag>
                            ) : isCalled ? (
                                <Tag color="cyan">Đã gọi ({record.callCount})</Tag>
                            ) : (
                                <Tag color="blue">Đang chờ</Tag>
                            )}
                        </div>
                        {record.callCount > 0 && !isCompleted && !isAbsent && !isClosed && (
                            <div className="text-[11px] text-clinic-text-muted mt-0.5 tabular-nums">
                                Đã gọi {record.callCount} lần
                            </div>
                        )}
                    </div>
                )
            },
        },
        {
            title: 'Thao tác điều phối',
            key: 'actions',
            align: 'right',
            width: 210,
            render: (_, record) => {
                const statusString = String(record.status || '').toLowerCase()
                const isInConsultation = statusString === 'in_consultation' || statusString === 'dang_kham'
                const isDeferred = statusString === 'deferred' || statusString === 'tam_hoan'
                const isCompleted = statusString === 'completed' || statusString === 'da_kham'
                const isAbsent = statusString === 'bo_kham'
                const isClosed = statusString === 'da_dong_ve' || statusString === 'cancelled'
                const isTerminal = isCompleted || isAbsent || isClosed

                const menuItems = [
                    {
                        key: 'history',
                        label: 'Lịch sử chặng & thao tác',
                        icon: <HistoryOutlined />,
                        onClick: () => onOpenHistoryModal(record),
                    },
                    {
                        key: 'print',
                        label: 'Xem & In phiếu nhiệt mini (80mm)',
                        icon: <PrinterOutlined />,
                        onClick: () => onPrintReceipt(record),
                    },
                    {
                        type: 'divider',
                    },
                    {
                        key: 'defer',
                        label: 'Tạm hoãn lượt khám',
                        icon: <ClockCircleOutlined />,
                        disabled: isInConsultation || isTerminal || isDeferred,
                        onClick: () => onOpenActionModal(record, 'DEFER'),
                    },
                    {
                        key: 'absent',
                        label: 'Bệnh nhân vắng mặt',
                        icon: <CloseCircleOutlined />,
                        disabled: isInConsultation || isTerminal,
                        onClick: () => onMarkAbsent(record),
                    },
                    {
                        key: 'cancel',
                        label: 'Hủy lượt khám',
                        icon: <CloseCircleOutlined />,
                        danger: true,
                        disabled: isInConsultation || isTerminal,
                        onClick: () => onOpenActionModal(record, 'CANCEL'),
                    },
                ]

                return (
                    <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                        {isDeferred ? (
                            <Button
                                size="small"
                                type="primary"
                                className="medpro-btn-primary text-xs font-bold"
                                icon={<PlayCircleOutlined />}
                                onClick={() => onResume(record)}
                            >
                                Tiếp tục
                            </Button>
                        ) : !isTerminal ? (
                            <Button
                                size="small"
                                type="primary"
                                icon={<SoundOutlined />}
                                className="medpro-btn-primary text-xs font-bold"
                                onClick={() => onCallNumber(record)}
                            >
                                {record.callCount > 0 ? `Gọi lại (${record.callCount})` : 'Gọi số'}
                            </Button>
                        ) : null}

                        <Tooltip title="Xem & In phiếu nhiệt STT (80mm)">
                            <Button
                                size="small"
                                icon={<PrinterOutlined />}
                                className="text-xs text-clinic-cta"
                                onClick={() => onPrintReceipt(record)}
                            />
                        </Tooltip>

                        {!isInConsultation && !isTerminal && (
                            <Button
                                size="small"
                                icon={<SwapOutlined />}
                                className="text-xs"
                                onClick={() => onOpenActionModal(record, 'TRANSFER')}
                                title="Chuyển buồng"
                            >
                                Chuyển
                            </Button>
                        )}

                        <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
                            <Button size="small" icon={<MoreOutlined />} className="text-xs text-clinic-text-secondary" />
                        </Dropdown>
                    </div>
                )
            },
        },
    ]

    return (
        <Table
            columns={columns}
            dataSource={dataSource}
            rowKey="id"
            loading={loading}
            pagination={{
                pageSize: 10,
                showSizeChanger: true,
                pageSizeOptions: ['10', '20', '50'],
                showTotal: (total) => `Tổng số: ${total} lượt khám`,
            }}
            size="middle"
            locale={{
                emptyText: (
                    <div className="py-8 text-center">
                        <Empty
                            description={
                                <div className="space-y-1">
                                    <p className="font-semibold text-clinic-navy text-sm">
                                        Không có bệnh nhân nào trong hàng đợi
                                    </p>
                                    <p className="text-xs text-clinic-text-muted">
                                        {selectedRoomId !== null
                                            ? selectedRoomObject?.doctorId
                                                ? `Buồng khám ${selectedRoomObject?.name} (${selectedRoomObject?.doctorName}) hiện chưa có bệnh nhân nào trong hàng đợi.`
                                                : `Buồng khám ${selectedRoomObject?.name} hôm nay chưa có Bác sĩ vào ca trực theo Lịch làm việc.`
                                            : 'Hiện tại chưa có người bệnh nào cần điều phối ở danh mục này.'}
                                    </p>
                                </div>
                            }
                        >
                            {(selectedRoomId !== null || searchQuery || activeTab !== 'WAITING') && (
                                <Button
                                    type="primary"
                                    size="small"
                                    onClick={onResetAllFilters}
                                    className="medpro-btn-primary text-xs font-bold mt-2"
                                >
                                    Đặt lại tất cả bộ lọc
                                </Button>
                            )}
                        </Empty>
                    </div>
                ),
            }}
        />
    )
}
