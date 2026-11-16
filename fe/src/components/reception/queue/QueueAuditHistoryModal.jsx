import React from 'react'
import { Modal, Button, Timeline, Spin, Tag, Empty } from 'antd'
import dayjs from 'dayjs'

const getTicketStages = (entry) => {
    if (!entry) return []
    const stages = []
    const roomName = entry.phong_kham || 'Quầy tiếp tân'

    if (entry.thoi_gian_check_in || entry.created_at) {
        stages.push({
            stage: 'TIẾP NHẬN & CẤP SỐ',
            time: dayjs(entry.thoi_gian_check_in || entry.created_at).format('HH:mm (DD/MM)'),
            room: 'Quầy tiếp đón lễ tân',
            color: 'blue',
        })
    }

    if (entry.thoi_gian_xep_hang_lai || entry.rawStatus === 'tam_hoan') {
        stages.push({
            stage: 'TẠM HOÃN & XẾP HÀNG LẠI',
            time: entry.thoi_gian_xep_hang_lai
                ? dayjs(entry.thoi_gian_xep_hang_lai).format('HH:mm (DD/MM)')
                : 'Đang tạm hoãn',
            room: roomName,
            color: 'orange',
        })
    }

    if (entry.thoi_gian_goi_kham || (entry.so_lan_goi && entry.so_lan_goi > 0)) {
        stages.push({
            stage: `GỌI VÀO PHÒNG KHÁM (Lần ${entry.so_lan_goi || 1})`,
            time: entry.thoi_gian_goi_kham
                ? dayjs(entry.thoi_gian_goi_kham).format('HH:mm (DD/MM)')
                : 'Đã phát loa gọi',
            room: roomName,
            color: 'green',
        })
    }

    if (entry.thoi_gian_bat_dau || entry.rawStatus === 'dang_kham') {
        stages.push({
            stage: 'BÁC SĨ KHÁM LÂM SÀNG',
            time: entry.thoi_gian_bat_dau
                ? dayjs(entry.thoi_gian_bat_dau).format('HH:mm (DD/MM)')
                : 'Đang khám',
            room: roomName,
            color: 'cyan',
        })
    }

    if (entry.rawStatus === 'bo_kham') {
        stages.push({
            stage: 'BỆNH NHÂN BỎ KHÁM',
            time: entry.thoi_gian_ket_thuc
                ? dayjs(entry.thoi_gian_ket_thuc).format('HH:mm (DD/MM)')
                : 'Đã hủy lượt khám',
            room: roomName,
            color: 'red',
        })
    } else if (entry.thoi_gian_ket_thuc || entry.rawStatus === 'da_kham' || entry.rawStatus === 'da_dong_ve') {
        stages.push({
            stage: 'HOÀN TẤT KHÁM & ĐÓNG VÉ',
            time: entry.thoi_gian_ket_thuc
                ? dayjs(entry.thoi_gian_ket_thuc).format('HH:mm (DD/MM)')
                : 'Đã hoàn tất',
            room: roomName,
            color: 'purple',
        })
    }

    return stages
}

export default function QueueAuditHistoryModal({
    open,
    entry,
    logs,
    isLoading,
    onClose,
}) {
    const stages = getTicketStages(entry)
    const ticketNumber = entry?.ticketNumber || entry?.ma_so_thu_tu || ''

    return (
        <Modal
            title={
                <span className="font-bold text-slate-800">
                    Lịch sử chặng & thao tác: Vé {ticketNumber}
                </span>
            }
            open={open}
            onCancel={onClose}
            footer={<Button onClick={onClose}>Đóng</Button>}
            width={560}
        >
            <div className="py-3 text-xs space-y-4">
                <h5 className="font-bold text-slate-700 uppercase">Hành trình khám thực tế</h5>
                {stages.length === 0 ? (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có thông tin hành trình khám" />
                ) : (
                    <Timeline
                        items={stages.map((stageItem) => ({
                            color: stageItem.color,
                            children: (
                                <div>
                                    <span className="font-bold text-slate-800">{stageItem.stage}</span> -{' '}
                                    <span className="text-slate-500">{stageItem.time}</span>
                                    <div className="text-slate-400 text-[11px]">{stageItem.room}</div>
                                </div>
                            ),
                        }))}
                    />
                )}

                <h5 className="font-bold text-slate-700 uppercase pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span>Nhật ký thao tác chi tiết (Audit Trail)</span>
                    {isLoading && <Spin size="small" />}
                </h5>
                {isLoading ? (
                    <div className="py-6 flex justify-center items-center">
                        <Spin tip="Đang tải nhật ký thao tác..." />
                    </div>
                ) : logs.length === 0 ? (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center text-slate-400">
                        Chưa ghi nhận thao tác điều phối nào cho vé này trong ngày hôm nay.
                    </div>
                ) : (
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2 max-h-60 overflow-y-auto text-[11px]">
                        {logs.map((log, index) => (
                            <div key={log.id || index} className="pb-2 border-b border-slate-200/60 last:border-0 last:pb-0">
                                <div className="flex items-center justify-between text-slate-500 font-mono text-[10px]">
                                    <span>{log.timestamp}</span>
                                    <Tag color="cyan" className="text-[10px] mr-0">{log.action_type}</Tag>
                                </div>
                                <div className="font-semibold text-slate-700 mt-0.5">
                                    {log.actor}: <span className="font-normal text-slate-600">{log.description}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Modal>
    )
}
