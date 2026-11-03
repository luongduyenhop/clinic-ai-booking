import { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import {
    Table,
    Tag,
    Button,
    Modal,
    Select,
    message,
    Alert,
    DatePicker,
} from 'antd'
import {
    SwapOutlined,
    SyncOutlined,
    WarningOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
    fetchDoctorAbsencesAsync,
    rebalanceQueueAsync,
    fetchReceptionDataAsync,
} from '../../redux/actions/reception/receptionAction'

export default function TasksPage() {
    const dispatch = useDispatch()
    const {
        doctorAbsences = [],
        loading = false,
    } = useSelector((state) => state.reception)

    // Sự cố & Cân bằng tải (API 7.1 & 7.2)
    const [incidentDate, setIncidentDate] = useState(() => dayjs().format('YYYY-MM-DD'))
    const [selectedIncident, setSelectedIncident] = useState(null)
    const [selectedTargetDoctor, setSelectedTargetDoctor] = useState(null)
    const [isRebalancing, setIsRebalancing] = useState(false)

    // Tải dữ liệu ban đầu
    useEffect(() => {
        dispatch(fetchReceptionDataAsync())
    }, [dispatch])

    // Load dữ liệu Sự cố bác sĩ nghỉ
    useEffect(() => {
        dispatch(fetchDoctorAbsencesAsync({ queryDate: incidentDate }))
    }, [dispatch, incidentDate])

    const handleRefresh = () => {
        dispatch(fetchDoctorAbsencesAsync({ queryDate: incidentDate }))
    }

    // ── Xử lý Điều chuyển hàng loạt (API 7.2) ─────────────────────────
    const handleConfirmRebalance = async () => {
        if (!selectedIncident) return
        setIsRebalancing(true)
        try {
            const res = await dispatch(
                rebalanceQueueAsync({
                    payload: {
                        nghi_phep_bac_si_id: selectedIncident.nghi_phep_id,
                        ticket_ids: null, // Tự động chuyển toàn bộ bệnh nhân đang chờ
                        bac_si_nhan_id: selectedTargetDoctor ? Number(selectedTargetDoctor) : null,
                    },
                })
            ).unwrap()

            const count = res?.so_ve_chuyen || res?.so_luong_chuyen_thanh_cong || selectedIncident.so_benh_nhan_cho || 0
            message.success(`Đã điều chuyển thành công ${count} bệnh nhân sang bác sĩ thay thế!`)
            setSelectedIncident(null)
            setSelectedTargetDoctor(null)
            dispatch(fetchDoctorAbsencesAsync({ queryDate: incidentDate }))
        } catch {
            // Toast thông báo lỗi bên phải đã được BaseService tự động kích hoạt
        } finally {
            setIsRebalancing(false)
        }
    }

    // Cột bảng Sự cố Bác sĩ nghỉ (API 7.1)
    const incidentColumns = [
        {
            title: 'Mức độ',
            key: 'severity',
            width: 110,
            render: () => (
                <Tag color="error" className="font-bold text-xs">
                    Khẩn cấp
                </Tag>
            ),
        },
        {
            title: 'Bác sĩ & Nội dung sự cố',
            key: 'title',
            render: (_, record) => (
                <div className="space-y-1">
                    <span className="font-bold text-slate-800 text-sm block">
                        Bác sĩ {record.ten_bac_si} ({record.ten_chuyen_khoa || 'Chuyên khoa'})
                    </span>
                    <p className="text-slate-600 text-xs">
                        Lý do: <strong>{record.ly_do}</strong> • Thời gian: {record.tu_ngay} {record.ca_lam_viec ? `(${record.ca_lam_viec === 'sang' ? 'Ca sáng' : 'Ca chiều'})` : ''}
                    </p>
                    {record.danh_sach_bac_si_thay_the && record.danh_sach_bac_si_thay_the.length > 0 && (
                        <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-1.5 pt-0.5">
                            <span>BS thay thế gợi ý:</span>
                            {record.danh_sach_bac_si_thay_the.map((alt) => (
                                <Tag key={alt.bac_si_id} color="cyan" className="mr-0">
                                    {alt.ten_bac_si} ({alt.phong_kham || 'Buồng'} - Chờ: {alt.so_benh_nhan_cho})
                                </Tag>
                            ))}
                        </div>
                    )}
                </div>
            ),
        },
        {
            title: 'Bệnh nhân bị kẹt',
            dataIndex: 'so_benh_nhan_cho',
            key: 'so_benh_nhan_cho',
            width: 160,
            render: (count, record) => {
                const total = count ?? record?.so_benh_nhan_bi_anh_huong ?? 0
                return (
                    <div>
                        <span className="font-bold text-red-600 text-base font-mono block">
                            {total} bệnh nhân
                        </span>
                        <span className="text-[10px] text-slate-400">Đang chờ khám</span>
                    </div>
                )
            },
        },
        {
            title: 'Thao tác',
            key: 'actions',
            width: 170,
            align: 'right',
            render: (_, record) => (
                <Button
                    size="small"
                    type="primary"
                    icon={<SwapOutlined />}
                    className="bg-sky-600 hover:bg-sky-700 text-xs font-semibold"
                    onClick={() => {
                        setSelectedIncident(record)
                        setSelectedTargetDoctor(null)
                    }}
                >
                    ⚡ Điều chuyển ngay
                </Button>
            ),
        },
    ]

    return (
        <div className="space-y-5">
            {/* Header info bar */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                            <WarningOutlined className="text-amber-500" />
                            Trung tâm Sự cố & Cân bằng tải hàng đợi
                        </h2>
                        <span className="text-xs text-slate-500">
                            Rà soát sự cố Bác sĩ khai báo nghỉ đột xuất, giải phóng bệnh nhân bị kẹt và tái cân bằng tải hàng loạt sang Bác sĩ khác cùng chuyên khoa
                        </span>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            icon={<SyncOutlined />}
                            onClick={handleRefresh}
                            className="text-xs font-semibold"
                        >
                            Làm mới
                        </Button>
                    </div>
                </div>
            </div>

            {/* SỰ CỐ BÁC SĨ NGHỈ ĐỘT XUẤT & ĐIỀU CHUYỂN HÀNG LOẠT (API 7.1 & 7.2) */}
            <div className="space-y-4">
                {/* Bộ lọc ngày sự cố */}
                <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex flex-wrap items-center gap-3 text-xs">
                    <span className="text-slate-400">Ngày rà soát sự cố:</span>
                    <DatePicker
                        format="DD/MM/YYYY"
                        value={dayjs(incidentDate)}
                        onChange={(d) => setIncidentDate(d ? d.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'))}
                    />
                </div>

                {/* Incident Alert Banner */}
                {doctorAbsences.length === 0 ? (
                    <Alert
                        message="Không có sự cố đột xuất"
                        description="Tất cả bác sĩ trong các chuyên khoa đang hoạt động đúng ca trực. Không có bệnh nhân nào bị gián đoạn hàng đợi."
                        type="success"
                        showIcon
                    />
                ) : (
                    <Alert
                        message={`Phát hiện ${doctorAbsences.length} bác sĩ nghỉ đột xuất cần điều chuyển`}
                        description="Vui lòng thực hiện điều chuyển bệnh nhân sang các bác sĩ thay thế trong cùng chuyên khoa để tránh ùn ứ hàng đợi."
                        type="warning"
                        showIcon
                    />
                )}

                {/* Table sự cố */}
                <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
                    <Table
                        columns={incidentColumns}
                        dataSource={doctorAbsences}
                        rowKey={(r) => r.nghi_phep_id || r.id || r.bac_si_id}
                        loading={loading}
                        pagination={{ pageSize: 10 }}
                        size="middle"
                        scroll={{ x: 700 }}
                        locale={{ emptyText: 'Không có sự cố nào cần xử lý' }}
                    />
                </div>
            </div>

            {/* Modal Điều chuyển hàng loạt (API 7.2) */}
            <Modal
                title={
                    <div className="flex items-center gap-2">
                        <SwapOutlined className="text-sky-600" />
                        <span>Điều chuyển hàng loạt: BS {selectedIncident?.ten_bac_si}</span>
                    </div>
                }
                open={Boolean(selectedIncident)}
                onCancel={() => setSelectedIncident(null)}
                footer={[
                    <Button key="back" onClick={() => setSelectedIncident(null)}>
                        Hủy bỏ
                    </Button>,
                    <Button
                        key="submit"
                        type="primary"
                        loading={isRebalancing}
                        onClick={handleConfirmRebalance}
                        className="bg-sky-600"
                    >
                        Xác nhận điều chuyển hàng loạt
                    </Button>,
                ]}
            >
                {selectedIncident && (
                    <div className="space-y-4 py-2 text-xs">
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                            <div><strong>Bác sĩ xin nghỉ:</strong> {selectedIncident.ten_bac_si}</div>
                            <div><strong>Chuyên khoa:</strong> {selectedIncident.ten_chuyen_khoa}</div>
                            <div><strong>Số bệnh nhân đang kẹt:</strong> <span className="font-bold text-red-600">{selectedIncident.so_benh_nhan_cho || 0} người</span></div>
                        </div>

                        <div className="space-y-1">
                            <label className="font-bold text-slate-700 block">Chọn bác sĩ tiếp nhận thay thế:</label>
                            <Select
                                className="w-full"
                                placeholder="-- Chọn bác sĩ hoặc để hệ thống Tự động Cân bằng tải --"
                                value={selectedTargetDoctor}
                                onChange={(val) => setSelectedTargetDoctor(val)}
                                allowClear
                                options={[
                                    { value: null, label: '⚡ Tự động Cân bằng tải đều (Phân phối xoay vòng cho BS ít người chờ nhất)' },
                                    ...(selectedIncident.danh_sach_bac_si_thay_the || []).map((alt) => ({
                                        value: alt.bac_si_id,
                                        label: `BS ${alt.ten_bac_si} (${alt.phong_kham || 'Buồng khám'} - Đang chờ: ${alt.so_benh_nhan_cho} BN)`,
                                    })),
                                ]}
                            />
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    )
}
