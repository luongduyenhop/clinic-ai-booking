import { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import {
    Modal,
    Button,
    Radio,
    Checkbox,
    Input,
    Tabs,
    Table,
    Tag,
    Alert,
    Spin,
    Result,
    Segmented,
    DatePicker,
    message,
} from 'antd'
import {
    LockOutlined,
    ReloadOutlined,
    CheckCircleOutlined,
    ExclamationCircleOutlined,
    ClockCircleOutlined,
    DollarOutlined,
    SwapOutlined,
    UserOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
    fetchShiftPreCloseAuditAsync,
    closeReceptionShiftAsync,
    fetchShiftDashboardAsync,
} from '../../redux/actions/reception/receptionAction'

export default function CloseShiftModal({ open, onCancel, onSuccess }) {
    const dispatch = useDispatch()
    const { shiftAuditData, shiftAuditLoading, closeShiftSubmitting } = useSelector(
        (state) => state.reception
    )

    // Xác định ca mặc định dựa theo thời gian thực (trước 12:30 -> ca sáng, sau 12:30 -> ca chiều)
    const currentHour = dayjs().hour()
    const currentMinute = dayjs().minute()
    const isMorningTime = currentHour < 12 || (currentHour === 12 && currentMinute <= 30)
    const [shiftType, setShiftType] = useState(() => (isMorningTime ? 'sang' : 'chieu'))
    const [shiftDate, setShiftDate] = useState(() => dayjs().format('YYYY-MM-DD'))

    // Form fields
    const [actionType, setActionType] = useState('CHUYEN_CA_TIEP_THEO')
    const [autoNoShow, setAutoNoShow] = useState(true)
    const [handoverNote, setHandoverNote] = useState('')
    const [closeResult, setCloseResult] = useState(null)

    // Tự động load dữ liệu Pre-close Audit khi mở Modal hoặc đổi ca/ngày
    useEffect(() => {
        if (open) {
            setCloseResult(null)
            dispatch(
                fetchShiftPreCloseAuditAsync({
                    caKham: shiftType,
                    queryDate: shiftDate,
                })
            )
        }
    }, [open, shiftType, shiftDate, dispatch])

    // Cập nhật phương án và ghi chú mặc định theo gợi ý từ Backend
    useEffect(() => {
        if (shiftAuditData?.de_xuat_hanh_dong) {
            const deXuat = shiftAuditData.de_xuat_hanh_dong
            if (deXuat.de_xuat_xu_ly_cho_kham) {
                setActionType(deXuat.de_xuat_xu_ly_cho_kham)
            } else {
                setActionType(shiftType === 'sang' ? 'CHUYEN_CA_TIEP_THEO' : 'DONG_VE')
            }
            if (deXuat.tu_dong_chot_no_show !== undefined) {
                setAutoNoShow(deXuat.tu_dong_chot_no_show)
            }
            if (deXuat.ghi_chu_canh_bao) {
                setHandoverNote(deXuat.ghi_chu_canh_bao)
            }
        }
    }, [shiftAuditData, shiftType])

    const handleRefreshAudit = () => {
        dispatch(
            fetchShiftPreCloseAuditAsync({
                caKham: shiftType,
                queryDate: shiftDate,
            })
        )
    }

    const handleConfirmCloseShift = async () => {
        const payload = {
            ca_kham: shiftType,
            ngay: shiftDate,
            xu_ly_cho_kham: actionType,
            tu_dong_chot_no_show: autoNoShow,
            ghi_chu_ban_giao: handoverNote?.trim() || undefined,
            nguoi_nhan_ban_giao_id: null, // Gán null theo phân công lịch trực hệ thống
        }

        try {
            const res = await dispatch(closeReceptionShiftAsync(payload)).unwrap()
            setCloseResult(res)
            message.success('Đóng ca trực Lễ tân thành công!')
            dispatch(fetchShiftDashboardAsync())
            if (onSuccess) onSuccess(res)
        } catch {
            // Lỗi đã được BaseService thông báo
        }
    }

    const canhBao = shiftAuditData?.canh_bao || {}
    const chiTiet = shiftAuditData?.chi_tiet || {}

    // Bảng Chờ khám
    const choKhamColumns = [
        {
            title: 'Mã vé / STT',
            dataIndex: 'ticket_code',
            key: 'ticket_code',
            width: 110,
            render: (code) => <Tag color="blue" className="font-mono font-bold">{code}</Tag>,
        },
        {
            title: 'Bệnh nhân',
            dataIndex: 'ten_benh_nhan',
            key: 'ten_benh_nhan',
            render: (name, record) => (
                <div>
                    <span className="font-bold text-slate-800">{name}</span>
                    <span className="text-[11px] text-slate-400 block">
                        {record.loai_hang_doi === 'vang_lai' ? 'Vãng lai' : 'Đặt hẹn trước'}
                    </span>
                </div>
            ),
        },
        {
            title: 'Bác sĩ & Phòng khám',
            key: 'doctor_room',
            render: (_, record) => (
                <div>
                    <span className="text-xs font-medium text-slate-700 block">{record.ten_bac_si}</span>
                    <span className="text-[11px] text-slate-400">{record.phong_kham}</span>
                </div>
            ),
        },
        {
            title: 'Thời gian chờ',
            dataIndex: 'thoi_gian_cho_phut',
            key: 'thoi_gian_cho_phut',
            width: 120,
            render: (mins) => (
                <span className="font-semibold text-amber-700">
                    <ClockCircleOutlined className="mr-1" />
                    {mins ?? 0} phút
                </span>
            ),
        },
    ]

    // Bảng Đang khám
    const dangKhamColumns = [
        {
            title: 'Mã vé',
            dataIndex: 'ticket_code',
            key: 'ticket_code',
            width: 110,
            render: (code) => <Tag color="green" className="font-mono font-bold">{code}</Tag>,
        },
        {
            title: 'Bệnh nhân',
            dataIndex: 'ten_benh_nhan',
            key: 'ten_benh_nhan',
            render: (name) => <span className="font-bold text-slate-800">{name}</span>,
        },
        {
            title: 'Bác sĩ phụ trách',
            dataIndex: 'ten_bac_si',
            key: 'ten_bac_si',
        },
        {
            title: 'Phòng khám',
            dataIndex: 'phong_kham',
            key: 'phong_kham',
        },
        {
            title: 'Giờ vào khám',
            dataIndex: 'gio_vao_kham',
            key: 'gio_vao_kham',
            width: 120,
            render: (time) => <span className="text-slate-600 font-mono font-medium">{time}</span>,
        },
    ]

    return (
        <Modal
            title={
                <div className="flex items-center gap-2 text-slate-800 font-bold">
                    <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                        <LockOutlined className="text-base" />
                    </div>
                    <span>Đối soát & Đóng ca trực Lễ tân</span>
                </div>
            }
            open={open}
            onCancel={onCancel}
            width={860}
            footer={null}
            destroyOnClose
            className="top-6"
        >
            {closeResult ? (
                <Result
                    status="success"
                    title="Đã đóng ca trực thành công!"
                    subTitle={
                        <div className="space-y-1.5 text-xs text-slate-600 pt-2 text-left max-w-md mx-auto bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <div><strong>Ca làm việc:</strong> {closeResult.ca_kham_dong === 'sang' ? 'Ca sáng' : 'Ca chiều'} (Ngày: {closeResult.ngay})</div>
                            <div><strong>Số vé chuyển sang ca chiều:</strong> <span className="font-bold text-sky-600">{closeResult.so_ve_chuyen_ca_chieu || 0} vé</span></div>
                            <div><strong>Số vé đóng cuối ngày:</strong> <span className="font-bold text-slate-600">{closeResult.so_ve_dong || 0} vé</span></div>
                            <div><strong>Số lịch hẹn chốt No-show:</strong> <span className="font-bold text-amber-600">{closeResult.so_lich_chot_no_show || 0} lịch</span></div>
                            <div><strong>Người đóng ca:</strong> {closeResult.nguoi_dong_ca || 'Lễ tân'}</div>
                            <div><strong>Thời gian đóng:</strong> {dayjs(closeResult.thoi_gian_dong_ca).format('HH:mm:ss DD/MM/YYYY')}</div>
                            {closeResult.ghi_chu_ban_giao && (
                                <div className="pt-1 text-slate-500 italic">
                                    &quot;{closeResult.ghi_chu_ban_giao}&quot;
                                </div>
                            )}
                        </div>
                    }
                    extra={[
                        <Button key="close" type="primary" className="bg-sky-600" onClick={onCancel}>
                            Hoàn tất & Đóng cửa sổ
                        </Button>,
                    ]}
                />
            ) : (
                <div className="space-y-4 pt-2">
                    {/* Thanh chọn ca trực và ngày đối soát */}
                    <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-600">Ca trực cần đóng:</span>
                            <Segmented
                                options={[
                                    { label: '☀️ Ca sáng (07:00 - 11:30)', value: 'sang' },
                                    { label: '🌙 Ca chiều (13:30 - 17:30)', value: 'chieu' },
                                ]}
                                value={shiftType}
                                onChange={(val) => setShiftType(val)}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <DatePicker
                                value={dayjs(shiftDate)}
                                onChange={(d) => setShiftDate(d ? d.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'))}
                                format="DD/MM/YYYY"
                                allowClear={false}
                                className="w-32 text-xs"
                            />
                            <Button
                                size="small"
                                icon={<ReloadOutlined />}
                                onClick={handleRefreshAudit}
                                loading={shiftAuditLoading}
                            >
                                Quét lại
                            </Button>
                        </div>
                    </div>

                    {shiftAuditLoading ? (
                        <div className="py-12 flex flex-col items-center justify-center gap-3">
                            <Spin size="large" />
                            <span className="text-xs text-slate-500">Đang quét toàn bộ CSDL và đối soát ca trực...</span>
                        </div>
                    ) : (
                        <>
                            {/* 6 Thẻ KPI Cảnh Báo Đối Soát Tổng Quan */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-center">
                                <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
                                    <div className="text-[11px] text-emerald-800 font-medium">Đang khám</div>
                                    <div className="text-lg font-bold text-emerald-700 font-mono">
                                        {canhBao.so_dang_kham || 0}
                                    </div>
                                    <div className="text-[9px] text-emerald-600 truncate">Bảo toàn khám</div>
                                </div>

                                <div className="p-2.5 rounded-xl bg-red-50/70 border border-red-200">
                                    <div className="text-[11px] text-red-800 font-medium">Chờ tại sảnh</div>
                                    <div className="text-lg font-bold text-red-700 font-mono">
                                        {canhBao.so_cho_kham_chua_kham || 0}
                                    </div>
                                    <div className="text-[9px] text-red-600 truncate">Chưa vào buồng</div>
                                </div>

                                <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200">
                                    <div className="text-[11px] text-amber-800 font-medium">Tạm hoãn</div>
                                    <div className="text-lg font-bold text-amber-700 font-mono">
                                        {canhBao.so_tam_hoan || 0}
                                    </div>
                                    <div className="text-[9px] text-amber-600 truncate">Gọi ≥ 3 lần</div>
                                </div>

                                <div className="p-2.5 rounded-xl bg-purple-50/70 border border-purple-200">
                                    <div className="text-[11px] text-purple-800 font-medium">Hẹn No-show</div>
                                    <div className="text-lg font-bold text-purple-700 font-mono">
                                        {canhBao.so_lich_hen_no_show || 0}
                                    </div>
                                    <div className="text-[9px] text-purple-600 truncate">Quá giờ chưa đến</div>
                                </div>

                                <div className="p-2.5 rounded-xl bg-sky-50/70 border border-sky-200">
                                    <div className="text-[11px] text-sky-800 font-medium">Waitlist tồn</div>
                                    <div className="text-lg font-bold text-sky-700 font-mono">
                                        {canhBao.so_waitlist_ton || 0}
                                    </div>
                                    <div className="text-[9px] text-sky-600 truncate">Đang chờ slot</div>
                                </div>

                                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                                    <div className="text-[11px] text-slate-700 font-medium truncate">Thu ngân</div>
                                    <div className="text-xs font-bold text-slate-800 mt-1 truncate">
                                        {canhBao.thu_ngan_da_khoa_so ? (
                                            <Tag color="success" className="mr-0 text-[10px]">Đã khóa sổ</Tag>
                                        ) : (
                                            <Tag color="warning" className="mr-0 text-[10px]">Chưa khóa</Tag>
                                        )}
                                    </div>
                                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                        {(canhBao.tien_mat_da_thu || 0).toLocaleString('vi-VN')}đ
                                    </div>
                                </div>
                            </div>

                            {/* Thông báo nhắc nhở bảo toàn ca đang khám */}
                            {canhBao.so_dang_kham > 0 && (
                                <Alert
                                    type="info"
                                    showIcon
                                    message="Bảo toàn lâm sàng cho ca đang khám"
                                    description={`Hiện có ${canhBao.so_dang_kham} bệnh nhân đang ở trong buồng khám. Thao tác đóng ca Lễ tân sẽ không ngắt quãng quá trình điều trị của Bác sĩ.`}
                                    className="text-xs"
                                />
                            )}

                            {/* Danh sách việc tồn chi tiết */}
                            <div className="border border-slate-200 rounded-xl overflow-hidden">
                                <Tabs
                                    defaultActiveKey="waiting"
                                    size="small"
                                    className="px-3 pt-2"
                                    items={[
                                        {
                                            key: 'waiting',
                                            label: `Chờ khám (${chiTiet.cho_kham?.length || 0})`,
                                            children: (
                                                <Table
                                                    columns={choKhamColumns}
                                                    dataSource={chiTiet.cho_kham || []}
                                                    rowKey="ticket_id"
                                                    size="small"
                                                    pagination={false}
                                                    scroll={{ y: 160 }}
                                                    locale={{ emptyText: 'Không có bệnh nhân nào đang chờ tại sảnh' }}
                                                />
                                            ),
                                        },
                                        {
                                            key: 'consulting',
                                            label: `Đang khám (${chiTiet.dang_kham?.length || 0})`,
                                            children: (
                                                <Table
                                                    columns={dangKhamColumns}
                                                    dataSource={chiTiet.dang_kham || []}
                                                    rowKey="ticket_id"
                                                    size="small"
                                                    pagination={false}
                                                    scroll={{ y: 160 }}
                                                    locale={{ emptyText: 'Không có ca nào đang khám dở' }}
                                                />
                                            ),
                                        },
                                        {
                                            key: 'hold_noshow',
                                            label: `Tạm hoãn & No-show (${(chiTiet.tam_hoan?.length || 0) + (chiTiet.lich_hen_no_show?.length || 0)})`,
                                            children: (
                                                <div className="space-y-3 py-1 text-xs">
                                                    <div>
                                                        <span className="font-bold text-amber-800 block mb-1">
                                                            Vé tạm hoãn sau 3 lần gọi ({chiTiet.tam_hoan?.length || 0}):
                                                        </span>
                                                        {(chiTiet.tam_hoan || []).length > 0 ? (
                                                            <div className="flex flex-wrap gap-2">
                                                                {chiTiet.tam_hoan.map((t) => (
                                                                    <Tag key={t.ticket_id} color="orange">
                                                                        {t.ticket_code} - {t.ten_benh_nhan} ({t.phong_kham})
                                                                    </Tag>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-400">Không có vé tạm hoãn</span>
                                                        )}
                                                    </div>
                                                    <div className="pt-2 border-t border-slate-100">
                                                        <span className="font-bold text-purple-800 block mb-1">
                                                            Lịch hẹn nguy cơ bùng hẹn ({chiTiet.lich_hen_no_show?.length || 0}):
                                                        </span>
                                                        {(chiTiet.lich_hen_no_show || []).length > 0 ? (
                                                            <div className="flex flex-wrap gap-2">
                                                                {chiTiet.lich_hen_no_show.map((l) => (
                                                                    <Tag key={l.lich_kham_id} color="purple">
                                                                        {l.ma_lich_kham || `LK-${l.lich_kham_id}`} - {l.ten_benh_nhan} ({l.gio_kham})
                                                                    </Tag>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-400">Không có lịch quá giờ</span>
                                                        )}
                                                    </div>
                                                </div>
                                            ),
                                        },
                                        {
                                            key: 'cashier',
                                            label: 'Đối chiếu Thu ngân',
                                            children: (
                                                <div className="p-3 bg-slate-50/70 rounded-lg text-xs space-y-1.5">
                                                    {chiTiet.doi_chieu_thu_ngan ? (
                                                        <>
                                                            <div className="flex justify-between">
                                                                <span className="text-slate-500">Trạng thái khóa sổ két:</span>
                                                                <span className="font-semibold">
                                                                    {chiTiet.doi_chieu_thu_ngan.da_khoa_so ? (
                                                                        <Tag color="success">Đã khóa sổ ({chiTiet.doi_chieu_thu_ngan.ma_khoa_so || 'N/A'})</Tag>
                                                                    ) : (
                                                                        <Tag color="error">Chưa chốt ca thu ngân</Tag>
                                                                    )}
                                                                </span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-slate-500">Thu ngân chốt:</span>
                                                                <span className="font-medium text-slate-800">{chiTiet.doi_chieu_thu_ngan.thu_ngan_chot || 'N/A'}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-slate-500">Tổng tiền mặt:</span>
                                                                <span className="font-bold text-slate-800 font-mono">
                                                                    {(chiTiet.doi_chieu_thu_ngan.tong_tien_mat || 0).toLocaleString('vi-VN')} đ
                                                                </span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-slate-500">Tổng chuyển khoản / QR:</span>
                                                                <span className="font-bold text-sky-700 font-mono">
                                                                    {(chiTiet.doi_chieu_thu_ngan.tong_chuyen_khoan || 0).toLocaleString('vi-VN')} đ
                                                                </span>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <span className="text-slate-400">Chưa có thông tin đối chiếu từ quầy thu ngân</span>
                                                    )}
                                                </div>
                                            ),
                                        },
                                    ]}
                                />
                            </div>

                            {/* Cấu hình Phương Án Đóng Ca & Bàn Giao */}
                            <div className="p-4 rounded-xl bg-slate-50/90 border border-slate-200 space-y-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                        Phương án xử lý các vé chờ chưa khám:
                                    </label>
                                    <Radio.Group
                                        value={actionType}
                                        onChange={(e) => setActionType(e.target.value)}
                                        className="space-y-1.5"
                                    >
                                        <Radio value="CHUYEN_CA_TIEP_THEO" className="text-xs">
                                            <strong>Chuyển sang ca chiều (Khuyên dùng cho ca sáng):</strong> Giữ nguyên số thứ tự (STT) để Bác sĩ ca chiều tiếp tục gọi khám.
                                        </Radio>
                                        <Radio value="DONG_VE" className="text-xs">
                                            <strong>Đóng vé dứt điểm (Khuyên dùng khi hết ngày):</strong> Hủy các lượt chưa khám còn tồn và chốt ngày làm việc.
                                        </Radio>
                                    </Radio.Group>
                                </div>

                                <div className="pt-2 border-t border-slate-200">
                                    <Checkbox
                                        checked={autoNoShow}
                                        onChange={(e) => setAutoNoShow(e.target.checked)}
                                        className="text-xs font-medium text-slate-700"
                                    >
                                        Tự động chốt vắng mặt (No-show) cho các lịch hẹn đã quá giờ khám mà chưa đến quầy tiếp đón
                                    </Checkbox>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Nội dung / Lời nhắn bàn giao ca trực:
                                    </label>
                                    <Input.TextArea
                                        rows={2}
                                        value={handoverNote}
                                        onChange={(e) => setHandoverNote(e.target.value)}
                                        placeholder="Nhập ghi chú bàn giao cho nhân viên ca tiếp theo..."
                                        className="text-xs"
                                    />
                                </div>
                            </div>

                            {/* Nút hành động */}
                            <div className="flex justify-end gap-2 pt-2">
                                <Button onClick={onCancel} disabled={closeShiftSubmitting}>
                                    Hủy bỏ
                                </Button>
                                <Button
                                    type="primary"
                                    danger
                                    icon={<LockOutlined />}
                                    loading={closeShiftSubmitting}
                                    onClick={handleConfirmCloseShift}
                                    className="font-semibold shadow-sm"
                                >
                                    Xác nhận Đóng ca & Bàn giao
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            )}
        </Modal>
    )
}

