import React from 'react'
import { Table, Tag, Button, Popconfirm, Empty } from 'antd'
import { CheckCircleOutlined, PhoneOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { formatDoctorName } from '../../../utils/doctorHelper'

export default function QueueWaitlistTable({
    dataSource,
    loading,
    selectedRoomId,
    selectedRoomObject,
    onSelectAllRooms,
    onCheckInWaitlist,
    onCancelWaitlist,
}) {
    const columns = [
        {
            title: 'STT Chờ',
            key: 'stt',
            width: 130,
            render: (_, record, index) => (
                <div className="flex items-center gap-1.5">
                    <Tag color="gold" className="font-mono font-bold text-xs m-0">
                        {`#${record.thu_tu_uu_tien || index + 1}`}
                    </Tag>
                    <span className="font-mono font-bold text-sky-800 text-xs">
                        WAIT-{String(record.id).padStart(2, '0')}
                    </span>
                </div>
            ),
        },
        {
            title: 'Họ và tên người bệnh',
            key: 'patient',
            render: (_, record) => (
                <div>
                    <div className="font-bold text-slate-900 text-xs">{record.ten_benh_nhan}</div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                        <span><PhoneOutlined /> {record.so_dien_thoai || 'N/A'}</span>
                        <span>•</span>
                        <span>{record.gioi_tinh || 'Khác'}</span>
                        {record.nam_sinh && <span>({record.nam_sinh})</span>}
                    </div>
                </div>
            ),
        },
        {
            title: 'Chuyên khoa & Bác sĩ chỉ định',
            key: 'doctor',
            render: (_, record) => (
                <div>
                    <div className="font-semibold text-slate-800 text-xs">
                        {record.ten_chuyen_khoa || 'Chuyên khoa chung'}
                    </div>
                    <div className="text-[11px] mt-0.5">
                        {record.co_bac_si_chi_dinh && record.ten_bac_si ? (
                            <span className="text-sky-700 font-medium">{formatDoctorName(record.ten_bac_si)}</span>
                        ) : (
                            <Tag color="cyan" className="text-[10px] m-0">
                                ⚡ Tự động phân bổ (ít chờ nhất)
                            </Tag>
                        )}
                    </div>
                </div>
            ),
        },
        {
            title: 'Buồng khám dự kiến',
            key: 'room',
            render: (_, record) => (
                <span className="text-xs text-slate-700 font-medium">
                    {record.ten_phong || 'Theo phân bổ tối ưu'}
                </span>
            ),
        },
        {
            title: 'Thời gian đăng ký',
            key: 'time',
            width: 140,
            render: (_, record) => (
                <div className="text-xs text-slate-600">
                    <div>{record.thoi_gian_dang_ky ? dayjs(record.thoi_gian_dang_ky).format('HH:mm') : 'N/A'}</div>
                    <div className="text-[10px] text-slate-400">
                        {record.thoi_gian_dang_ky ? dayjs(record.thoi_gian_dang_ky).format('DD/MM/YYYY') : ''}
                    </div>
                </div>
            ),
        },
        {
            title: 'Trạng thái',
            key: 'status',
            width: 170,
            render: (_, record) => {
                if (record.trang_thai === 'da_thong_bao') {
                    return (
                        <Tag color="green" className="font-bold text-[11px] m-0">
                            Đang giữ slot (còn {record.con_han_giu_slot ? '30p' : 'hết hạn'})
                        </Tag>
                    )
                }
                return (
                    <Tag color="orange" className="font-bold text-[11px] m-0">
                        Đang chờ slot trống
                    </Tag>
                )
            },
        },
        {
            title: 'Thao tác tiếp nhận',
            key: 'actions',
            width: 230,
            render: (_, record) => (
                <div className="flex items-center gap-2">
                    <Button
                        type="primary"
                        size="small"
                        icon={<CheckCircleOutlined />}
                        onClick={() => onCheckInWaitlist(record.id)}
                        className="medpro-btn-primary font-bold text-xs"
                    >
                        Tiếp nhận vào khám
                    </Button>
                    <Popconfirm
                        title="Hủy lượt chờ?"
                        description="Xác nhận hủy lượt của bệnh nhân khỏi danh sách chờ?"
                        onConfirm={() => onCancelWaitlist(record.id)}
                        okText="Xác nhận"
                        cancelText="Hủy"
                        okButtonProps={{ danger: true }}
                    >
                        <Button size="small" danger className="text-xs font-semibold">
                            Hủy chờ
                        </Button>
                    </Popconfirm>
                </div>
            ),
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
                showTotal: (total) => `Tổng số: ${total} người đang chờ slot`,
            }}
            size="middle"
            locale={{
                emptyText: (
                    <div className="py-8 text-center">
                        <Empty
                            description={
                                <div className="space-y-1">
                                    <p className="font-semibold text-slate-700 text-sm">
                                        Không có bệnh nhân nào trong Danh sách chờ (Waitlist)
                                    </p>
                                    <p className="text-xs text-slate-400">
                                        {selectedRoomId !== null
                                            ? `Buồng khám ${selectedRoomObject?.name} hiện chưa có ai trong danh sách chờ.`
                                            : 'Tất cả ca khám và bác sĩ hiện tại đều đang tiếp nhận bình thường.'}
                                    </p>
                                </div>
                            }
                        >
                            {selectedRoomId !== null && (
                                <Button
                                    type="primary"
                                    size="small"
                                    onClick={onSelectAllRooms}
                                    className="bg-amber-600 text-xs font-semibold mt-2"
                                >
                                    Xem Danh sách chờ tất cả các buồng
                                </Button>
                            )}
                        </Empty>
                    </div>
                ),
            }}
        />
    )
}
