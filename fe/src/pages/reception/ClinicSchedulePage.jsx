import { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Tag, Select, DatePicker, Button, Alert, Progress, Tabs, Table, Empty } from 'antd'
import {
    UserOutlined,
    SwapOutlined,
    MedicineBoxOutlined,
    ReloadOutlined,
    CalendarOutlined,
    ApartmentOutlined,
    CheckCircleOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { useNavigate } from 'react-router-dom'
import {
    fetchReceptionDataAsync,
    fetchShiftDashboardAsync,
    fetchRosterAsync,
    fetchRosterTemplateAsync,
    fetchRoomsAsync,
    fetchDoctorAbsencesAsync,
} from '../../redux/actions/reception/receptionAction'

const DAY_OF_WEEK_NAMES = {
    2: 'Thứ Hai',
    3: 'Thứ Ba',
    4: 'Thứ Tư',
    5: 'Thứ Năm',
    6: 'Thứ Sáu',
    7: 'Thứ Bảy',
    8: 'Chủ Nhật',
}

const ROOM_TYPE_LABELS = {
    kham_benh: { label: 'Khám lâm sàng', color: 'blue' },
    xet_nghiem: { label: 'Xét nghiệm', color: 'purple' },
    chan_doan_hinh_anh: { label: 'Chẩn đoán hình ảnh', color: 'cyan' },
}

export default function ClinicSchedulePage() {
    const navigate = useNavigate()
    const dispatch = useDispatch()
    const {
        roster = [],
        rosterTemplate = [],
        rooms = [],
        doctorAbsences = [],
        departments = [],
        roomStatus = [],
        loading = false,
    } = useSelector((state) => state.reception)

    const [activeTab, setActiveTab] = useState('daily_roster')

    // Tự động chọn ca trực theo thời gian thực (Sáng nếu < 12h, Chiều nếu >= 12h)
    const [selectedShift, setSelectedShift] = useState(() => (dayjs().hour() < 12 ? 'sang' : 'chieu'))
    const [selectedDate, setSelectedDate] = useState(() => dayjs().format('YYYY-MM-DD'))
    const [selectedDep, setSelectedDep] = useState('')

    // Tab 2: Lịch mẫu tuần
    const [selectedDayOfWeek, setSelectedDayOfWeek] = useState('')

    // Tab 3: Buồng khám vật lý
    const [selectedRoomDep, setSelectedRoomDep] = useState('')

    // Nạp dữ liệu ban đầu
    useEffect(() => {
        dispatch(fetchReceptionDataAsync())
    }, [dispatch])

    // Load dữ liệu Tab 1 (Lịch trực thực tế & Trạng thái buồng khám)
    useEffect(() => {
        const caParam = selectedShift === 'all' ? undefined : selectedShift
        dispatch(
            fetchRosterAsync({
                queryDate: selectedDate,
                caKham: caParam,
                chuyenKhoaId: selectedDep || undefined,
            })
        )
        dispatch(
            fetchDoctorAbsencesAsync({
                queryDate: selectedDate,
                caKham: caParam,
            })
        )
        dispatch(
            fetchShiftDashboardAsync({
                queryDate: selectedDate,
                caKham: caParam,
            })
        )
    }, [dispatch, selectedDate, selectedShift, selectedDep])

    // Load dữ liệu Tab 2 (Lịch mẫu định kỳ tuần)
    useEffect(() => {
        if (activeTab === 'template') {
            dispatch(
                fetchRosterTemplateAsync({
                    thuTrongTuan: selectedDayOfWeek ? Number(selectedDayOfWeek) : undefined,
                })
            )
        }
    }, [dispatch, activeTab, selectedDayOfWeek])

    // Load dữ liệu Tab 3 (Danh mục buồng khám vật lý)
    useEffect(() => {
        if (activeTab === 'physical_rooms') {
            dispatch(
                fetchRoomsAsync({
                    chuyenKhoaId: selectedRoomDep ? Number(selectedRoomDep) : undefined,
                })
            )
        }
    }, [dispatch, activeTab, selectedRoomDep])

    const handleRefresh = () => {
        const caParam = selectedShift === 'all' ? undefined : selectedShift
        dispatch(fetchReceptionDataAsync())
        dispatch(fetchRosterAsync({ queryDate: selectedDate, caKham: caParam, chuyenKhoaId: selectedDep || undefined }))
        dispatch(fetchDoctorAbsencesAsync({ queryDate: selectedDate, caKham: caParam }))
        dispatch(fetchShiftDashboardAsync({ queryDate: selectedDate, caKham: caParam }))
        if (activeTab === 'template') {
            dispatch(fetchRosterTemplateAsync({ thuTrongTuan: selectedDayOfWeek ? Number(selectedDayOfWeek) : undefined }))
        }
        if (activeTab === 'physical_rooms') {
            dispatch(fetchRoomsAsync({ chuyenKhoaId: selectedRoomDep ? Number(selectedRoomDep) : undefined }))
        }
    }

    // Danh sách chuyên khoa cho bộ lọc
    const departmentOptions = (departments || []).map((d) => ({
        value: d.id,
        label: d.name || d.ten_chuyen_khoa,
    }))

    // Cột bảng Lịch trực mẫu định kỳ theo tuần (API 6.3)
    const templateColumns = [
        {
            title: 'Thứ trong tuần',
            dataIndex: 'thu_trong_tuan',
            key: 'thu_trong_tuan',
            width: 140,
            render: (thu) => (
                <Tag color="geekblue" className="font-bold">
                    {DAY_OF_WEEK_NAMES[thu] || `Thứ ${thu}`}
                </Tag>
            ),
        },
        {
            title: 'Bác sĩ phụ trách',
            dataIndex: 'ten_bac_si',
            key: 'ten_bac_si',
            render: (name) => <strong className="text-slate-900">{name || 'N/A'}</strong>,
        },
        {
            title: 'Buồng khám định kỳ',
            dataIndex: 'phong_kham',
            key: 'phong_kham',
            render: (room) => <span className="font-medium text-slate-700">{room || 'Chưa gán'}</span>,
        },
        {
            title: 'Ca trực',
            dataIndex: 'ca_lam_viec',
            key: 'ca_lam_viec',
            width: 150,
            render: (shift, record) => (
                <div>
                    <Tag color={shift === 'sang' ? 'orange' : 'purple'}>
                        {shift === 'sang' ? 'Ca sáng' : shift === 'chieu' ? 'Ca chiều' : shift}
                    </Tag>
                    {record.gio_bat_dau && record.gio_ket_thuc && (
                        <div className="text-[11px] text-slate-400 mt-0.5">
                            {record.gio_bat_dau} - {record.gio_ket_thuc}
                        </div>
                    )}
                </div>
            ),
        },
        {
            title: 'Trạng thái',
            dataIndex: 'is_active',
            key: 'is_active',
            width: 120,
            render: (active) => (
                <Tag color={active !== false ? 'success' : 'default'}>
                    {active !== false ? 'Đang áp dụng' : 'Tạm ngưng'}
                </Tag>
            ),
        },
    ]

    // Cột bảng Buồng khám vật lý (API 6.2)
    const roomColumns = [
        {
            title: 'Mã phòng',
            dataIndex: 'ma_phong',
            key: 'ma_phong',
            width: 110,
            render: (code) => <span className="font-mono font-bold text-sky-700">{code}</span>,
        },
        {
            title: 'Tên buồng khám vật lý',
            dataIndex: 'ten_phong',
            key: 'ten_phong',
            render: (name) => <strong className="text-slate-800">{name}</strong>,
        },
        {
            title: 'Vị trí tầng',
            dataIndex: 'tang',
            key: 'tang',
            width: 120,
            render: (floor) => <Tag color="blue">{floor || 'Tầng 1'}</Tag>,
        },
        {
            title: 'Chuyên khoa',
            dataIndex: 'ten_chuyen_khoa',
            key: 'ten_chuyen_khoa',
            render: (spec) => spec ? <span className="text-slate-700">{spec}</span> : <span className="text-slate-400 italic">Dùng chung / Cận lâm sàng</span>,
        },
        {
            title: 'Loại buồng',
            dataIndex: 'loai_phong',
            key: 'loai_phong',
            width: 180,
            render: (type) => {
                const conf = ROOM_TYPE_LABELS[type] || { label: type || 'Khác', color: 'default' }
                return <Tag color={conf.color}>{conf.label}</Tag>
            },
        },
        {
            title: 'Trạng thái',
            dataIndex: 'is_active',
            key: 'is_active',
            width: 130,
            render: (active) => (
                <Tag color={active !== false ? 'success' : 'error'}>
                    {active !== false ? 'Đang hoạt động' : 'Tạm dừng'}
                </Tag>
            ),
        },
    ]

    return (
        <div className="space-y-5">
            {/* Header chung */}
            <div className="medpro-card p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-sm font-extrabold text-[#003553] uppercase tracking-wide">Quản lý Lịch trực & Nguồn lực phòng khám</h2>
                        <span className="text-xs text-slate-500">
                            Điều phối ca trực bác sĩ thực tế, khuôn mẫu lịch định kỳ tuần và giám sát công suất buồng khám vật lý
                        </span>
                    </div>
                    <Button
                        size="small"
                        icon={<ReloadOutlined />}
                        loading={loading}
                        onClick={handleRefresh}
                        className="medpro-btn-outline !h-8 !px-3 text-xs font-semibold"
                    >
                        Làm mới
                    </Button>
                </div>

                {/* Tabs Điều hướng 3 Phân hệ */}
                <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    size="middle"
                    items={[
                        {
                            key: 'daily_roster',
                            label: (
                                <span className="font-semibold">
                                    <UserOutlined /> Lịch trực thực tế & Sức chứa ca ({roster.length})
                                </span>
                            ),
                        },
                        {
                            key: 'template',
                            label: (
                                <span className="font-semibold">
                                    <CalendarOutlined /> Lịch trực định kỳ theo tuần (Khuôn mẫu)
                                </span>
                            ),
                        },
                        {
                            key: 'physical_rooms',
                            label: (
                                <span className="font-semibold">
                                    <ApartmentOutlined /> Danh mục buồng khám vật lý ({rooms.length})
                                </span>
                            ),
                        },
                    ]}
                />
            </div>

            {/* TAB 1: Lịch trực thực tế & Tình trạng buồng khám */}
            {activeTab === 'daily_roster' && (
                <div className="space-y-5">
                    {/* Thanh lọc Tab 1 */}
                    <div className="medpro-card p-3 flex flex-wrap items-center gap-3 text-xs">
                        <div>
                            <span className="text-slate-400 mr-2">Ngày khám:</span>
                            <DatePicker
                                format="DD/MM/YYYY"
                                value={dayjs(selectedDate)}
                                onChange={(d) => setSelectedDate(d ? d.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'))}
                            />
                        </div>
                        <div>
                            <span className="text-slate-400 mr-2">Ca trực:</span>
                            <Select
                                className="w-52"
                                value={selectedShift}
                                onChange={setSelectedShift}
                                options={[
                                    { value: 'all', label: 'Tất cả các ca' },
                                    { value: 'sang', label: 'Ca sáng (07:30 - 11:30)' },
                                    { value: 'chieu', label: 'Ca chiều (13:30 - 16:30)' },
                                ]}
                            />
                        </div>
                        <div>
                            <span className="text-slate-400 mr-2">Chuyên khoa:</span>
                            <Select
                                className="w-60"
                                placeholder="Tất cả chuyên khoa"
                                value={selectedDep || undefined}
                                onChange={(val) => setSelectedDep(val || '')}
                                allowClear
                                options={departmentOptions}
                            />
                        </div>
                    </div>

                    {/* Cảnh báo Bác sĩ vắng mặt đột xuất */}
                    {doctorAbsences.length > 0 && (
                        <div className="space-y-3">
                            {doctorAbsences.map((inc) => (
                                <Alert
                                    key={inc.bac_si_id}
                                    message={`Bác sĩ ${inc.ten_bac_si} nghỉ đột xuất (Khoa ${inc.ten_chuyen_khoa || 'Chuyên khoa'})`}
                                    description={`Có ${inc.so_benh_nhan_bi_anh_huong || 0} bệnh nhân trong ca trực cần được điều chuyển sang bác sĩ khác cùng chuyên khoa.`}
                                    type="error"
                                    showIcon
                                    action={
                                        <Button
                                            size="small"
                                            danger
                                            icon={<SwapOutlined />}
                                            onClick={() => navigate('/reception/tasks')}
                                        >
                                            Điều chuyển bệnh nhân
                                        </Button>
                                    }
                                />
                            ))}
                        </div>
                    )}

                    {/* Lưới Lịch trực Bác sĩ 100% từ API (API 6.1) */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                <UserOutlined className="text-sky-600" />
                                Danh sách Bác sĩ trực ca ({roster.length} bác sĩ)
                            </h3>
                        </div>

                        {roster.length === 0 ? (
                            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center">
                                <Empty description="Không có lịch phân ca trực nào phù hợp với bộ lọc ngày và ca khám đã chọn" />
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {roster.map((doc, idx) => {
                                    const isAbsent = doctorAbsences.some((a) => a.bac_si_id === (doc.bac_si_id || doc.id))
                                    const roomName = doc.ten_phong || doc.ma_phong || 'Chưa xếp phòng'
                                    const specialtyName = doc.chuyen_khoa || 'Chuyên khoa'
                                    const shiftName = doc.ca_lam_viec === 'sang'
                                        ? 'Ca sáng (07:30 - 11:30)'
                                        : doc.ca_lam_viec === 'chieu'
                                            ? 'Ca chiều (13:30 - 16:30)'
                                            : doc.ca_lam_viec || 'Cả ngày'

                                    const capacity = doc.gioi_han_ca_kham || 30
                                    const currentCount = doc.so_luot_da_nhan || 0
                                    const isFull = currentCount >= capacity
                                    const percentUsed = Math.min(100, Math.round((currentCount / capacity) * 100))

                                    return (
                                        <div
                                            key={doc.lich_lam_viec_id || doc.bac_si_id || idx}
                                            className={`p-4 rounded-2xl border transition shadow-2xs space-y-3 ${isAbsent
                                                ? 'bg-red-50/40 border-red-200'
                                                : isFull
                                                    ? 'bg-amber-50/30 border-amber-300'
                                                    : 'bg-white border-slate-200/90 hover:border-sky-300'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <h4 className="font-bold text-slate-900 text-sm">{doc.ten_bac_si}</h4>
                                                    <span className="text-[11px] text-slate-500">{specialtyName}</span>
                                                </div>
                                                <div className="flex flex-col items-end gap-1">
                                                    <Tag
                                                        color={isAbsent ? 'error' : doc.is_active === false ? 'default' : 'success'}
                                                        className="mr-0 text-[10px] font-bold"
                                                    >
                                                        {isAbsent ? 'Nghỉ đột xuất' : doc.is_active === false ? 'Hủy ca' : 'Đang trực'}
                                                    </Tag>
                                                    {isFull && (
                                                        <Tag color="red" className="mr-0 text-[10px] font-bold">
                                                            Đầy ca
                                                        </Tag>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="text-xs text-slate-600 space-y-1.5 pt-1 border-t border-slate-100">
                                                <div className="flex justify-between">
                                                    <span className="text-slate-400">Phòng trực:</span>
                                                    <span className="font-semibold text-slate-800 text-right max-w-[170px] truncate" title={roomName}>
                                                        {roomName}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-400">Ca trực:</span>
                                                    <span className="font-medium text-slate-700">{shiftName}</span>
                                                </div>
                                                <div className="space-y-1 pt-1">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-slate-400">Sức chứa ca:</span>
                                                        <span className={`font-bold ${isFull ? 'text-rose-600' : 'text-sky-700'}`}>
                                                            {currentCount} / {capacity} lượt
                                                        </span>
                                                    </div>
                                                    <Progress
                                                        percent={percentUsed}
                                                        size="small"
                                                        status={isFull ? 'exception' : (percentUsed >= 80 ? 'active' : 'normal')}
                                                        strokeColor={isFull ? '#ef4444' : (percentUsed >= 80 ? '#f59e0b' : '#0284c7')}
                                                        showInfo={false}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {/* Giám sát phụ tải buồng khám thời gian thực (API 6.4) */}
                    <div className="medpro-card p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <MedicineBoxOutlined className="text-emerald-600" />
                                    Giám sát phụ tải buồng khám thời gian thực ({roomStatus.length} phòng)
                                </h3>
                                <span className="text-xs text-slate-500">
                                    Cập nhật bác sĩ ngồi buồng, bệnh nhân đang khám và cảnh báo quá tải hàng chờ (≥ 5 người)
                                </span>
                            </div>
                        </div>

                        {roomStatus.length === 0 ? (
                            <div className="p-6 text-center text-slate-400 text-xs">
                                Chưa có dữ liệu trạng thái buồng khám cho ca trực này
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                {roomStatus.map((room) => {
                                    const isOverloaded = room.canh_bao_qua_tai || (room.so_benh_nhan_cho >= 5)
                                    const waitingCount = room.so_benh_nhan_cho || 0

                                    return (
                                        <div
                                            key={room.phong_kham_id || room.id}
                                            className={`p-3.5 rounded-xl border space-y-2.5 transition ${isOverloaded
                                                ? 'bg-amber-50/50 border-amber-300'
                                                : 'bg-white border-slate-200 hover:border-slate-300'
                                            }`}
                                        >
                                            <div className="flex justify-between items-start gap-1">
                                                <div>
                                                    <div className="font-bold text-slate-800 text-xs">
                                                        {room.ten_phong}
                                                    </div>
                                                    <div className="text-slate-400 text-[10px]">
                                                        {room.chuyen_khoa || 'Chuyên khoa'} • {room.tang || 'Tầng 1'}
                                                    </div>
                                                </div>
                                                <Tag
                                                    color={isOverloaded ? 'error' : (room.ten_bac_si ? 'processing' : 'default')}
                                                    className="mr-0 text-[10px] font-semibold"
                                                >
                                                    {isOverloaded ? 'Quá tải' : (room.ten_bac_si ? 'Đang khám' : 'Chưa phân ca')}
                                                </Tag>
                                            </div>

                                            <div className="space-y-1 bg-slate-50 p-2 rounded-lg border border-slate-100 text-[11px]">
                                                <div className="flex justify-between text-slate-600">
                                                    <span className="text-slate-400">Bác sĩ:</span>
                                                    <span className="font-medium text-slate-800 truncate max-w-[130px]" title={room.ten_bac_si || 'Chưa gán'}>
                                                        {room.ten_bac_si || 'Chưa gán'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between text-slate-600">
                                                    <span className="text-slate-400">Đang khám:</span>
                                                    <span className="font-medium text-emerald-700 truncate max-w-[130px]" title={room.benh_nhan_dang_kham || 'Buồng trống'}>
                                                        {room.benh_nhan_dang_kham || 'Buồng trống'}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex justify-between items-center text-[11px] pt-1 border-t border-slate-100">
                                                <span className="text-slate-500">Đang chờ:</span>
                                                <span className={`font-bold px-1.5 py-0.5 rounded text-[11px] ${waitingCount >= 5 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>
                                                    {waitingCount} người
                                                </span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB 2: Lịch trực định kỳ theo tuần (API 6.3) */}
            {activeTab === 'template' && (
                <div className="medpro-card p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                        <div>
                            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                <CalendarOutlined className="text-sky-600" />
                                Khuôn mẫu phân ca trực định kỳ theo tuần
                            </h3>
                            <span className="text-xs text-slate-500">
                                Phục vụ Lễ tân tra cứu lịch khám định kỳ hàng tuần để tư vấn người bệnh
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400">Lọc theo ngày:</span>
                            <Select
                                className="w-52"
                                placeholder="Tất cả các ngày"
                                value={selectedDayOfWeek || undefined}
                                onChange={(val) => setSelectedDayOfWeek(val || '')}
                                allowClear
                                options={[
                                    { value: '', label: 'Tất cả các ngày trong tuần' },
                                    { value: '2', label: 'Thứ Hai' },
                                    { value: '3', label: 'Thứ Ba' },
                                    { value: '4', label: 'Thứ Tư' },
                                    { value: '5', label: 'Thứ Năm' },
                                    { value: '6', label: 'Thứ Sáu' },
                                    { value: '7', label: 'Thứ Bảy' },
                                    { value: '8', label: 'Chủ Nhật' },
                                ]}
                            />
                        </div>
                    </div>

                    <Table
                        columns={templateColumns}
                        dataSource={rosterTemplate}
                        rowKey="id"
                        pagination={false}
                        size="middle"
                        locale={{ emptyText: 'Chưa có khuôn mẫu ca trực nào được thiết lập' }}
                    />
                </div>
            )}

            {/* TAB 3: Danh mục buồng khám vật lý (API 6.2) */}
            {activeTab === 'physical_rooms' && (
                <div className="medpro-card p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                        <div>
                            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                <ApartmentOutlined className="text-emerald-600" />
                                Danh mục buồng phòng vật lý & phân bổ chuyên khoa
                            </h3>
                            <span className="text-xs text-slate-500">
                                Toàn bộ cơ sở vật chất phòng ốc gồm phòng khám, xét nghiệm và chẩn đoán hình ảnh
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400">Lọc chuyên khoa:</span>
                            <Select
                                className="w-60"
                                placeholder="Tất cả chuyên khoa"
                                value={selectedRoomDep || undefined}
                                onChange={(val) => setSelectedRoomDep(val || '')}
                                allowClear
                                options={departmentOptions}
                            />
                        </div>
                    </div>

                    <Table
                        columns={roomColumns}
                        dataSource={rooms}
                        rowKey="id"
                        pagination={false}
                        size="middle"
                        locale={{ emptyText: 'Không tìm thấy buồng khám nào' }}
                    />
                </div>
            )}
        </div>
    )
}
